import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from 'react';
import {
  Button,
  message,
  Modal,
  Table,
  Tag,
  Space,
  Typography,
  Tooltip,
  Input,
  UploadProps,
  Upload,
  TablePaginationConfig,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  StopOutlined,
  UploadOutlined,
  PlusCircleFilled,
  PlusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import config from '@/utils/config';
import { PageContainer } from '@ant-design/pro-layout';
import { request } from '@/utils/http';
import ActionModal from './modal';
import EditNameModal from './editNameModal';
import './index.less';
import { exportJson } from '@/utils/index';
import { useOutletContext } from '@umijs/max';
import { SharedContext } from '@/layouts';
import useTableScrollHeight from '@/hooks/useTableScrollHeight';
import Copy from '../../components/copy';
import { useVT } from 'virtualizedtableforantd4';
import dayjs from 'dayjs';
import intl from '@/utils/intl'
import { FilterValue, SorterResult } from 'antd/lib/table/interface';

const { Paragraph } = Typography;
const { Search } = Input;

enum Status {
  '已启用',
  '已禁用',
}

enum StatusColor {
  'success',
  'error',
}
enum Colors {
  'yellow',
  'blue',
  'green',
  'red',
}
enum OperationName {
  '启用',
  '禁用',
}

enum OperationPath {
  'enable',
  'disable',
}


const Action = () => {


const [pageConf, setPageConf] = useState<{
  page: number;
  size: number;
  sorter: any;
  filters: any;
}>({} as any);

const [total, setTotal] = useState<number>();

const onPageChange = (
  pagination: TablePaginationConfig,
  filters: Record<string, FilterValue | null>,
  sorter: SorterResult<any> | SorterResult<any>[],
) => {
  const { current, pageSize } = pagination;
  setPageConf({
    page: current as number,
    size: pageSize as number,
    sorter,
    filters,
  });
  localStorage.setItem('pageSize', String(pageSize));
};


  const { headerStyle, isPhone, theme } = useOutletContext<SharedContext>();
  const columns: any = [
    {
      title: intl.get('序号'),
      width: 80,
      render: (text: string, record: any, index: number) => {
        return <span style={{ cursor: 'text' }}>{index + 1} </span>;
      },
    },
    {
      title: intl.get('名称'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
      render: (text: string, record: any) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={text} placement="topLeft">
              <div className="text-ellipsis">{text}</div>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: intl.get('备注'),
      dataIndex: 'remarks',
      key: 'remarks',
      render: (text: string, record: any) => {
        return (
          <Tooltip title={text} placement="topLeft">
            <div className="text-ellipsis">{text}</div>
          </Tooltip>
        );
      },
    },
    {
      title: intl.get('所属应用'),
      dataIndex: 'app_name',
      key: 'app_name',
      render: (text: string, record: any) => {
        return (
          <Tooltip title={text} placement="topLeft">
            <div className="text-ellipsis">{text}</div>
          </Tooltip>
        );
      },
    },
    {
      title: intl.get('授权角色'),
      dataIndex: 'roles',
      key: 'needPermission',
      width: 125,
      render: (text: string, record: any, index: number) => {
        return record.roles.length == 0 ? (
          <Tag style={{ marginRight: 0 }}>
            无控制
          </Tag>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {record.roles.map((role: any, i: number) => {
              return (
                <Tag color={Colors[i%4]} style={{ marginRight: 0 }} key={role}>
                  {(config.roleMap as any)[role]}
                </Tag>
              );
            })}
          </div>
        );
      },
    },
    {
      title: intl.get('更新时间'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 185,
      ellipsis: {
        showTitle: false,
      },
      sorter: {
        compare: (a: any, b: any) => {
          const updatedAtA = new Date(a.updatedAt || a.timestamp).getTime();
          const updatedAtB = new Date(b.updatedAt || b.timestamp).getTime();
          return updatedAtA - updatedAtB;
        },
      },
      render: (text: string, record: any) => {
        const date = dayjs(record.updatedAt || record.timestamp).format(
          'YYYY-MM-DD HH:mm:ss',
        );
        return (
          <Tooltip
            placement="topLeft"
            title={date}
            trigger={['hover', 'click']}
          >
            <span>{date}</span>
          </Tooltip>
        );
      },
    },
    {
      title: intl.get('状态'),
      key: 'status',
      dataIndex: 'status',
      width: 100,
      filters: [
        {
          text: intl.get('已启用'),
          value: 0,
        },
        {
          text: intl.get('已禁用'),
          value: 1,
        },
      ],
      onFilter: (value: number, record: any) => record.status === value,
      render: (text: string, record: any, index: number) => {
        return (
          <Space size="middle" style={{ cursor: 'text' }}>
            <Tag color={StatusColor[record.status]} style={{ marginRight: 0 }}>
              {intl.get(Status[record.status])}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: intl.get('操作'),
      key: 'action',
      width: 120,
      render: (text: string, record: any, index: number) => {
        const isPc = !isPhone;
        return (
          <Space size="middle">
            <Tooltip title={isPc ? intl.get('编辑') : ''}>
              <a onClick={() => editAction(record, index)}>
                <EditOutlined />
              </a>
            </Tooltip>
            <Tooltip
              title={
                isPc
                  ? record.status === Status.已禁用
                    ? intl.get('启用')
                    : intl.get('禁用')
                  : ''
              }
            >
              <a onClick={() => enabledOrDisabledEnv(record, index)}>
                {record.status === Status.已禁用 ? (
                  <CheckCircleOutlined />
                ) : (
                  <StopOutlined />
                )}
              </a>
            </Tooltip>
            <Tooltip title={isPc ? intl.get('删除') : ''}>
              <a onClick={() => deleteAction(record, index)}>
                <DeleteOutlined />
              </a>
            </Tooltip>
          </Space>
        );
      },
    },
  ];
  const [value, setValue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [editedAction, setEditedAction] = useState();
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableScrollHeight = useTableScrollHeight(tableRef, 59);


  const getActions = () => {
    setLoading(true);
    const { page, size, sorter, filters } = pageConf;
    let url = `${config.apiPrefix}actions?searchValue=${searchText}&page=${page}&size=${size}&filters=${JSON.stringify(
      filters,
    )}`;
    if (sorter && sorter.column && sorter.order) {
      url += `&sorter=${JSON.stringify({
        field: sorter.column.key,
        type: sorter.order === 'ascend' ? 'ASC' : 'DESC',
      })}`;
    }
    request
      .get(url)
      .then(({ code, data }) => {
        if (code === 200) {
          setValue(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const enabledOrDisabledEnv = (record: any, index: number) => {
    Modal.confirm({
      title: `确认${
        record.status === Status.已禁用 ? intl.get('启用') : intl.get('禁用')
      }`,
      content: (
        <>
          {intl.get('确认')}
          {record.status === Status.已禁用
            ? intl.get('启用')
            : intl.get('禁用')}
          Env{' '}
          <Paragraph
            style={{ wordBreak: 'break-all', display: 'inline' }}
            ellipsis={{ rows: 6, expandable: true }}
            type="warning"
            copyable
          >
            {record.value}
          </Paragraph>{' '}
          {intl.get('吗')}
        </>
      ),
      onOk() {
        request
          .put(
            `${config.apiPrefix}actions/${
              record.status === Status.已禁用 ? 'enable' : 'disable'
            }`,
            [record.id],
          )
          .then(({ code, data }) => {
            if (code === 200) {
              message.success(
                `${
                  record.status === Status.已禁用
                    ? intl.get('启用')
                    : intl.get('禁用')
                }${intl.get('成功')}`,
              );
              const newStatus =
                record.status === Status.已禁用 ? Status.已启用 : Status.已禁用;
              const result = [...value];
              result.splice(index, 1, {
                ...record,
                status: newStatus,
              });
              setValue(result);
            }
          });
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  };

  const addAction = () => {
    setEditedAction(null as any);
    setIsModalVisible(true);
  };

  const editAction = (record: any, index: number) => {
    setEditedAction(record);
    setIsModalVisible(true);
  };

  const deleteAction = (record: any, index: number) => {
    Modal.confirm({
      title: intl.get('确认删除'),
      content: (
        <>
          {intl.get('确认删除API')}{' '}
          <Paragraph
            style={{ wordBreak: 'break-all', display: 'inline' }}
            ellipsis={{ rows: 6, expandable: true }}
            type="warning"
            copyable
          >
            {record.name}
          </Paragraph>{' '}
          {intl.get('吗')}
        </>
      ),
      onOk() {
        request
          .delete(`${config.apiPrefix}actions`, { data: [record.id] })
          .then(({ code, data }) => {
            if (code === 200) {
              message.success(intl.get('删除成功'));
              const result = [...value];
              result.splice(index, 1);
              setValue(result);
            }
          });
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  };

  const handleCancel = (action?: any[]) => {
    setIsModalVisible(false);
    getActions();
  };

  const handleEditNameCancel = (action?: any[]) => {
    setIsEditNameModalVisible(false);
    getActions();
  };

  const [vt, setVT] = useVT(
    () => ({ scroll: { y: tableScrollHeight } }),
    [tableScrollHeight],
  );

  useEffect(
    () =>
      setVT({
        body: {
        },
      }),
    [],
  );


  const onSelectChange = (selectedIds: any[]) => {
    setSelectedRowIds(selectedIds);
  };

  const rowSelection = {
    selectedRowKeys: selectedRowIds,
    onChange: onSelectChange,
  };

  const delActions = () => {
    Modal.confirm({
      title: intl.get('确认删除'),
      content: <>{intl.get('确认删除选中的API吗')}</>,
      onOk() {
        request
          .delete(`${config.apiPrefix}actions`, { data: selectedRowIds })
          .then(({ code, data }) => {
            if (code === 200) {
              message.success(intl.get('批量删除成功'));
              setSelectedRowIds([]);
              getActions();
            }
          });
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  };

  const operateActions = (operationStatus: number) => {
    Modal.confirm({
      title: `确认${OperationName[operationStatus]}`,
      content: (
        <>
          {intl.get('确认')}
          {OperationName[operationStatus]}
          {intl.get('选中的API吗')}
        </>
      ),
      onOk() {
        request
          .put(
            `${config.apiPrefix}actions/${OperationPath[operationStatus]}`,
            selectedRowIds,
          )
          .then(({ code, data }) => {
            if (code === 200) {
              getActions();
            }
          });
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  };

  const onSearch = (value: string) => {
    setSearchText(value.trim());
  };
  
  useEffect(() => {
    setPageConf({ ...pageConf, page: 1 });
  }, [searchText]);
  
  useEffect(() => {
    if (pageConf.page && pageConf.size) {
      getActions();
    }
  }, [pageConf]);
 
  useEffect(() => {
    setPageConf({ ...pageConf, page: 1, size: parseInt(localStorage.getItem('pageSize') || '20') });
  }, []);
  return (
    <PageContainer
      className="ql-container-wrapper env-wrapper"
      title={intl.get('调用管理') + ' Actions'}
      extra={[
        <Search
          placeholder={intl.get('请输入名称/值/备注')}
          style={{ width: 'auto' }}
          enterButton
          loading={loading}
          onSearch={onSearch}
        />,
        <Tooltip title={intl.get('注册API')}>
          <Button key="2" type="primary" icon={<PlusOutlined />} onClick={() => addAction()}>
          </Button>
        </Tooltip>,
        <Tooltip title={intl.get('刷新列表')}>
          <Button key="3" type="primary" icon={<ReloadOutlined />} onClick={() => getActions()}>
          </Button>
        </Tooltip>,
      ]}
      header={{
        style: headerStyle,
      }}
    >
      <div ref={tableRef}>
        {selectedRowIds.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              style={{ marginBottom: 5, marginLeft: 8 }}
              onClick={delActions}
            >
              {intl.get('批量删除')}
            </Button>
            <Button
              type="primary"
              onClick={() => operateActions(0)}
              style={{ marginLeft: 8, marginBottom: 5 }}
            >
              {intl.get('批量启用')}
            </Button>
            <Button
              type="primary"
              onClick={() => operateActions(1)}
              style={{ marginLeft: 8, marginRight: 8 }}
            >
              {intl.get('批量禁用')}
            </Button>
            <span style={{ marginLeft: 8 }}>
              {intl.get('已选择')}
              <a>{selectedRowIds?.length}</a>
              {intl.get('项')}
            </span>
          </div>
        )}
       <><Table
          columns={columns}
          rowSelection={rowSelection}
          pagination={{
            current: pageConf.page,
            pageSize: pageConf.size,
            showSizeChanger: true,
            simple: isPhone,
            total,
            showTotal: (total: number, range: number[]) =>
              `第 ${range[0]}-${range[1]} 条/总共 ${total} 条`,
            pageSizeOptions: [10, 20, 50, 100].sort(
              (a, b) => a - b,
            ),
          }}
          dataSource={value}
          rowKey="id"
          size="middle"
          scroll={{ x: '100%', y: tableScrollHeight }}
          loading={loading}
          onChange={onPageChange}
          components={isPhone || pageConf.size < 50 ? undefined : vt}
          onRow={(record: any, index: number | undefined) => {
            return {
              index,
              record
            } as any;
          }}
        /></>
      </div>
      <ActionModal
        visible={isModalVisible}
        handleCancel={handleCancel}
        action={editedAction}
      />
      <EditNameModal
        visible={isEditNameModalVisible}
        handleCancel={handleEditNameCancel}
        ids={selectedRowIds}
      />
    </PageContainer>
  );
};

export default Action;
