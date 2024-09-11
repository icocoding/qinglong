import intl from 'react-intl-universal';
import { useState, useEffect, useCallback, Key, useRef } from 'react';
import {
  TreeSelect,
  Tree,
  Input,
  Button,
  Modal,
  message,
  Typography,
  Tooltip,
  Dropdown,
  Menu,
  Empty,
  MenuProps,
  Divider,
} from 'antd';
import config from '@/utils/config';
import { PageContainer } from '@ant-design/pro-layout';
import Editor from '@monaco-editor/react';
import { request } from '@/utils/http';
import styles from './index.module.less';
import EditModal from './editModal';
import CodeMirror from '@uiw/react-codemirror';
import SplitPane from 'react-split-pane';
import {
  BugOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  FileFilled,
  FolderOutlined,
  FormOutlined,
  PlayCircleFilled,
  PlusOutlined,
  PlusSquareOutlined,
  RedoOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import EditScriptNameModal from './editNameModal';
import UploadModal from './uploadModal';
import debounce from 'lodash/debounce';
import { history, useOutletContext, useLocation } from '@umijs/max';
import { parse } from 'query-string';
import { depthFirstSearch, findNode, getEditorMode, getExtension } from '@/utils';
import { SharedContext } from '@/layouts';
import useFilterTreeData from '@/hooks/useFilterTreeData';
import uniq from 'lodash/uniq';
import IconFont from '@/components/iconfont';
import RenameModal from './renameModal';
import { langs } from '@uiw/codemirror-extensions-langs';
import { useHotkeys } from 'react-hotkeys-hook';
import prettyBytes from 'pretty-bytes';
import { LANG_MAP } from '@/utils/const';
const { Text } = Typography;

const Script = () => {
  const { headerStyle, isPhone, theme } = useOutletContext<SharedContext>();
  const [value, setValue] = useState(intl.get('请选择脚本文件'));
  const [select, setSelect] = useState<string>('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('');
  const [height, setHeight] = useState<number>();
  const treeDom = useRef<any>();
  const [isLogModalVisible, setIsLogModalVisible] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [isUnzipFile, setIsUnzipFile] = useState(false);
  const [isNpmProject, setIsNpmProject] = useState(false);
  const editorRef = useRef<any>(null);
  const [isAddFileModalVisible, setIsAddFileModalVisible] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isRenameFileModalVisible, setIsRenameFileModalVisible] =
    useState(false);
  const [currentNode, setCurrentNode] = useState<any>();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const FILE_EXTENSIONS = Object.keys(Object.assign({}, LANG_MAP));
  const getScripts = (needLoading: boolean = true) => {
    needLoading && setLoading(true);
    request
      .get(`${config.apiPrefix}scripts`)
      .then(({ code, data }) => {
        if (code === 200) {
          setData(data);
          initState();
          initGetScript(data);
        }
      })
      .finally(() => needLoading && setLoading(false));
  };
  
  const getDetail = (node: any) => {
    request
      .get(
        `${config.apiPrefix}scripts/detail?file=${encodeURIComponent(
          node.title,
        )}&path=${node.parent || ''}`,
      )
      .then(({ code, data }) => {
        if (code === 200) {
          setValue(data);
        }
      });
  };

  const initGetScript = (_data: any) => {
    const { p, s } = parse(history.location.search);
    if (s) {
      const vkey = `${p}/${s}`;
      const obj = {
        node: {
          title: s,
          key: p ? vkey : s,
          parent: p,
        },
      };
      const item = findNode(_data, (c) => c.key === obj.node.key);
      if (item) {
        setExpandedKeys([p as string]);
        onTreeSelect([vkey], obj);
      }
    }
  };

  const onSelect = (value: any, node: any) => {
    if (node.key === select || !value) {
      return;
    }

    // if (!value || node.type != 'file') {
    //   setSelect('');
    // } else {
    //   setSelect(node.key);
    // }

    setIsUnzipFile(false);

    setSelect(node.key);
    setCurrentNode(node);

    setIsNpmProject(false)

    if (node.type === 'directory') {
      setValue(intl.get('请选择脚本文件'));
      const index = node.children?.findIndex((c: any) => c.type === 'file' && c.title === 'package.json');
      setIsNpmProject(index >= 0)
      return;
    }

    // if (node.type === 'file') {
      const extension = getExtension(value);
      if (!FILE_EXTENSIONS.includes(extension)) {
        setIsEditable(false);
        setValue(`不支持当前文件[${extension}]预览`);
        if (extension === '.zip') {
          setIsUnzipFile(true)
        }
        return;
      } else {
        setIsEditable(true);
      }
    // }

    const newMode = getEditorMode(value);
    setMode(isPhone && newMode === 'typescript' ? 'javascript' : newMode);
    setValue(intl.get('加载中...'));
    getDetail(node);
  };

  const onTreeSelect = useCallback(
    (keys: Key[], e: any) => {
      const node = e.node;
      if (node.key === select && isEditing) {
        return;
      }
      const content = editorRef.current
        ? editorRef.current.getValue().replace(/\r\n/g, '\n')
        : value;
      if (content !== value) {
        Modal.confirm({
          title: `确认离开`,
          content: <>{intl.get('当前修改未保存，确定离开吗')}</>,
          onOk() {
            onSelect(keys[0], e.node);
            setIsEditing(false);
          },
          onCancel() {
            console.log('Cancel');
          },
        });
      } else {
        setIsEditing(false);
        onSelect(keys[0], e.node);
      }
    },
    [value, select, isEditing],
  );

  const onSearch = useCallback(
    (e: { target: { value: any; }; }) => {
      const keyword = e.target.value;
      debounceSearch(keyword);
    },
    [data],
  );

  const debounceSearch = useCallback(
    debounce((keyword) => {
      setSearchValue(keyword);
    }, 300),
    [data],
  );

  const { treeData: filterData, keys: searchExpandedKeys } = useFilterTreeData(
    data,
    searchValue,
    { treeNodeFilterProp: 'title' },
  );

  useEffect(() => {
    setExpandedKeys(uniq([...expandedKeys, ...searchExpandedKeys]));
  }, [searchExpandedKeys]);

  const onExpand = (expKeys: any) => {
    setExpandedKeys(expKeys);
  };

  const onDoubleClick = (e: any, node: any) => {
    if (node.type === 'file') {
      setSelect(node.key);
      setCurrentNode(node);
      editFile()
      // setIsEditing(true);
    }
  };
  const unzipFile = () => {
    // 解压文件
    setValue(intl.get('解压文件中...') || `解压文件[${currentNode.title}]中...`);
    setLoading(true)
    return new Promise((resolve, reject) => {
      request
        .post(`${config.apiPrefix}scripts/unzip`, {
          filename: currentNode.title,
          path: currentNode.parent || '',
        })
        .then(({ code, data }) => {
          if (code === 200) {
            message.success(`解压文件[${currentNode.title}]成功`);
            setValue('');
            setTimeout(()=>{
              getScripts(true);
            },500)
          }
          resolve(null);
        })
        .catch((e) => {
          setValue(`解压文件[${currentNode.title}]失败`);
          reject(e)
        })
        .finally(() => setLoading(false));
    });
  };

  const npmInstall = () => {
    // 解压文件
    setValue(`npm install ...`);
    setLoading(true)
    return new Promise((resolve, reject) => {
      request
        .post(`${config.apiPrefix}scripts/npmInstall`, {
          filename: currentNode.title,
          path: currentNode.parent || '',
        })
        .then(({ code, data }) => {
          if (code === 200) {
            message.success(`安装[${currentNode.title}]成功`);
            setValue(`安装[${currentNode.title}]成功`);
            setTimeout(()=>{
              getScripts(true);
            },500)
          }
          resolve(null);
        })
        .catch((e) => {
          setValue(`安装[${currentNode.title}]失败`);
          reject(e)
        })
        .finally(() => setLoading(false));
    });
  };

  const editFile = () => {
    setTimeout(() => {
      setIsEditing(isEditable);
    }, 300);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (!currentNode) {
      return;
    }
    setValue(intl.get('加载中...'));
    getDetail(currentNode);
  };

  const saveFile = () => {

    const content = editorRef.current
    ? editorRef.current.getValue().replace(/\r\n/g, '\n')
    : value;

    return new Promise((resolve, reject) => {
      request
        .put(`${config.apiPrefix}scripts`, {
          filename: currentNode.title,
          path: currentNode.parent || '',
          content,
        })
        .then(({ code, data }) => {
          if (code === 200) {
            message.success(`保存成功`);
            setValue(content);
            setIsEditing(false);
          }
          resolve(null);
        })
        .catch((e) => reject(e));
    });
    
    // 直接保存
    Modal.confirm({
      title: `确认保存`,
      content: (
        <>
          {intl.get('确认保存文件')}
          <Text style={{ wordBreak: 'break-all' }} type="warning">
            {' '}
            {currentNode.title}
          </Text>
          {intl.get('，保存后不可恢复')}
        </>
      ),
      onOk() {
        const content = editorRef.current
          ? editorRef.current.getValue().replace(/\r\n/g, '\n')
          : value;
        return new Promise((resolve, reject) => {
          request
            .put(`${config.apiPrefix}scripts`, {
              filename: currentNode.title,
              path: currentNode.parent || '',
              content,
            })
            .then(({ code, data }) => {
              if (code === 200) {
                message.success(`保存成功`);
                setValue(content);
                setIsEditing(false);
              }
              resolve(null);
            })
            .catch((e) => reject(e));
        });
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  };

  const deleteFile = () => {
    Modal.confirm({
      title: `确认删除`,
      content: (
        <>
          {intl.get('确认删除')}
          <Text style={{ wordBreak: 'break-all' }} type="warning">
            {' '}
            {select}{' '}
          </Text>
          {intl.get('文件')}
          {currentNode.type === 'directory' ? intl.get('夹及其子文件') : ''}
          {intl.get('，删除后不可恢复')}
        </>
      ),
      onOk() {
        request
          .delete(`${config.apiPrefix}scripts`, {
            data: {
              filename: currentNode.title,
              path: currentNode.parent || '',
              type: currentNode.type,
            },
          })
          .then(({ code }) => {
            if (code === 200) {
              message.success(`删除成功`);
              let newData = [...data];
              if (currentNode.parent) {
                newData = depthFirstSearch(
                  newData,
                  (c) => c.key === currentNode.key,
                );
              } else {
                const index = newData.findIndex(
                  (x) => x.key === currentNode.key,
                );
                if (index !== -1) {
                  newData.splice(index, 1);
                }
              }
              setData(newData);
              initState();
            }
          });
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  };

  const renameFile = () => {
    setIsRenameFileModalVisible(true);
  };

  const handleRenameFileCancel = () => {
    setIsRenameFileModalVisible(false);
    getScripts(false);
  };

  const addFile = () => {
    setIsAddFileModalVisible(true);
  };

  const addFileModalClose = (
    { filename, path, key }: { filename: string; path: string; key: string } = {
      filename: '',
      path: '',
      key: '',
    },
  ) => {
    if (filename) {
      let newData = [...data];
      const _file = { title: filename, key, parent: path };
      if (path) {
        newData = depthFirstSearch(newData, (c) => c.key === path, _file);
        const keys = path.split('/');
        const sKeys: string[] = [];
        keys.reduce((p, c) => {
          sKeys.push(p);
          return `${p}/${c}`;
        });
        setExpandedKeys([...expandedKeys, ...sKeys, path]);
      } else {
        newData.unshift(_file);
      }
      setData(newData);
      console.log("add path", path)
      onSelect(_file.title, _file);
      setIsEditing(true);
    }
    setIsAddFileModalVisible(false);
  };

  const downloadFile = () => {
    request
      .post(`${config.apiPrefix}scripts/download`, {
        filename: currentNode.title,
      })
      .then(({ code, data }) => {
        if (code === 200) {
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = currentNode.title;
          document.documentElement.appendChild(a);
          a.click();
          document.documentElement.removeChild(a);
        }
      });
  };

  const initState = () => {
    setSelect('');
    setCurrentNode(null);
    setValue(intl.get('请选择脚本文件'));
  };

  useEffect(() => {
    getScripts();
  }, []);

  useEffect(() => {
    if (treeDom.current) {
      setHeight(treeDom.current.clientHeight);
    }
  }, [treeDom.current, data]);

  useHotkeys(
    'mod+s',
    (e) => {
      if (isEditing) {
        saveFile();
      }
    },
    { enableOnFormTags: ['textarea'], preventDefault: true },
  );

  useHotkeys(
    'mod+d',
    (e) => {
      if (currentNode.title) {
        deleteFile();
      }
    },
    { preventDefault: true },
  );

  useHotkeys(
    'mod+o',
    (e) => {
      if (!isEditing) {
        addFile();
      }
    },
    { preventDefault: true },
  );

  useHotkeys(
    'mod+e',
    (e) => {
      if (currentNode.title) {
        cancelEdit();
      }
    },
    { preventDefault: true },
  );

  const action = (key: string | number) => {
    switch (key) {
      case 'save':
        saveFile();
        break;
      case 'exit':
        cancelEdit();
        break;
      default:
        break;
    }
  };

  const menuAction = (key: string | number) => {
    switch (key) {
      case 'add':
        addFile();
        break;
      case 'edit':
        editFile();
        break;
      case 'delete':
        deleteFile();
        break;
      case 'rename':
        renameFile();
        break;
      default:
        break;
    }
  };

  const menu: MenuProps = isEditing
    ? {
        items: [
          { label: intl.get('保存'), key: 'save', icon: <PlusOutlined /> },
          { label: intl.get('退出编辑'), key: 'exit', icon: <EditOutlined /> },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          action(key);
        },
      }
    : {
        items: [
          { label: intl.get('创建'), key: 'add', icon: <PlusOutlined /> },
          {
            label: intl.get('编辑'),
            key: 'edit',
            icon: <EditOutlined />,
            disabled: currentNode?.type != 'file',
          },
          {
            label: intl.get('重命名'),
            key: 'rename',
            icon: <IconFont type="ql-icon-rename" />,
            disabled: !select,
          },
          {
            label: intl.get('删除'),
            key: 'delete',
            icon: <DeleteOutlined />,
            disabled: !select,
          },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          menuAction(key);
        },
      };

  return (
    <PageContainer
      className="ql-container-wrapper log-wrapper"
      title={
        <>
          {select}
          {currentNode?.type === 'file' && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 12,
                color: '#999',
                display: 'inline-block',
                height: 14,
              }}
            >
              {prettyBytes(currentNode.size)}
            </span>
          )}
        </>
      }
      loading={loading}
      extra={
        isPhone
          ? [
              <TreeSelect
                treeExpandAction="click"
                className="log-select"
                value={select}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={data}
                placeholder={intl.get('请选择脚本')}
                fieldNames={{ value: 'key' }}
                treeNodeFilterProp="title"
                showSearch
                allowClear
                onSelect={onSelect}
              />,
              <Dropdown menu={menu} trigger={['click']}>
                <Button type="primary" icon={<EllipsisOutlined />} />
              </Dropdown>,
            ]
          : isEditing
          ? [
              <Button type="primary" onClick={saveFile}>
                {intl.get('保存')}
              </Button>,
              <Button type="primary" onClick={cancelEdit}>
                {intl.get('退出编辑')}
              </Button>,
            ]
          : [
            <Tooltip title={intl.get('刷新目录')}>
              <Button
                type="default"
                onClick={ () => {
                  getScripts();
                }
                  }
                  icon={<RedoOutlined />}
              >
              </Button>
            </Tooltip>,
            <Tooltip title={intl.get('解压文件') || '解压文件'}>
              <Button
                type="primary"
                disabled={!isUnzipFile}
                onClick={ () => { unzipFile(); } }
                icon={<PlusSquareOutlined />}
              >
              </Button>
            </Tooltip>,
            <Tooltip title={intl.get('npm 安装') || 'npm 安装'}>
              <Button
                type="primary"
                disabled={!isNpmProject}
                onClick={ () => { npmInstall(); } }
                icon={<PlayCircleFilled />}
              >
              </Button>
            </Tooltip>,
            <><Divider type='vertical' /></>,
              // <Tooltip title={intl.get('上传文件')}>
              //   <Button
              //     type="default"
              //     onClick={ () => {
              //       uploadFile();
              //         }
              //       }
              //       icon={<UploadOutlined />}
              //   >
              //   </Button>
              // </Tooltip>,
              <Tooltip title={intl.get('创建')}>
                <Button
                  type="primary"
                  onClick={addFile}
                  icon={<PlusOutlined />} />
              </Tooltip>,
              <Tooltip title={intl.get('编辑')}>
                <Button
                  disabled={!isEditable}
                  type="primary"
                  onClick={editFile}
                  icon={<EditOutlined />}
                />
              </Tooltip>,
              <Tooltip title={intl.get('重命名')}>
                <Button
                  disabled={!currentNode}
                  type="primary"
                  onClick={renameFile}
                  icon={<IconFont type="ql-icon-rename" />}
                />
              </Tooltip>,
              <Tooltip title={intl.get('删除')}>
                <Button
                  type="primary"
                  disabled={!select}
                  onClick={deleteFile}
                  icon={<DeleteOutlined />}
                />
              </Tooltip>,
              <Tooltip title={intl.get('调试')}>
                <Button
                  type="primary"
                  onClick={() => {
                    setIsLogModalVisible(true);
                  }}
                  icon={
                    <BugOutlined />
                  }
                >
                </Button>
              </Tooltip>,
            ]
      }
      header={{
        style: headerStyle,
      }}
    >
      <div className={`${styles['log-container']} log-container`}>
        {!isPhone && (
          /*// @ts-ignore*/
          <SplitPane split="vertical" size={200} maxSize={-100}>
            <div className={styles['left-tree-container']}>
              {data.length > 0 ? (
                <>
                  <Input.Search
                    className={styles['left-tree-search']}
                    onChange={onSearch}
                    placeholder={intl.get('请输入脚本名')}
                    allowClear
                  ></Input.Search>
                  <div className={styles['left-tree-scroller']} ref={treeDom}>
                    <Tree
                      expandAction="click"
                      className={styles['left-tree']}
                      treeData={filterData}
                      showIcon={true}
                      icon={(nodeData:any) => {
                        return nodeData.type == 'file' ? <FileFilled/>:<FolderOutlined/>
                      }}
                      height={height}
                      selectedKeys={[select]}
                      expandedKeys={expandedKeys}
                      onExpand={onExpand}
                      showLine={{ showLeafIcon: false }}
                      onSelect={onTreeSelect}
                      onDoubleClick={onDoubleClick}
                    ></Tree>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <Empty
                    description={intl.get('暂无脚本')}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </div>
              )}
            </div>
            <Editor
              language={isEditing ? mode : ''}
              value={value}
              theme={theme}
              options={{
                readOnly: !isEditing,
                fontSize: 12,
                lineNumbersMinChars: 3,
                glyphMargin: false,
              }}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
            />
          </SplitPane>
        )}
        {isPhone && (
          <CodeMirror
            value={value}
            extensions={
              mode ? [langs[mode as keyof typeof langs]()] : undefined
            }
            theme={theme.includes('dark') ? 'dark' : 'light'}
            readOnly={!isEditing}
            onChange={(value) => {
              setValue(value);
            }}
          />
        )}
        {isLogModalVisible && (
          <EditModal
            visible={isLogModalVisible}
            treeData={data}
            currentNode={currentNode}
            content={value}
            handleCancel={() => {
              setIsLogModalVisible(false);
            }}
          />
        )}
        <EditScriptNameModal
          visible={isAddFileModalVisible}
          treeData={data}
          currentNode={currentNode}
          handleCancel={addFileModalClose}
          onSuccess={getScripts}
          // defaultType={defaultType}
        />
        <RenameModal
          visible={isRenameFileModalVisible}
          handleCancel={handleRenameFileCancel}
          currentNode={currentNode}
        />
      </div>
    </PageContainer>
  );
};

export default Script;
