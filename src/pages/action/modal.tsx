import React, { useEffect, useState } from 'react';
import { Modal, message, Input, Form, Radio, Select, RadioChangeEvent, type FormInstance } from 'antd';
import { request } from '@/utils/http';
import config from '@/utils/config';
import intl from '@/utils/intl'


const ActionModal = ({
  action,
  handleCancel,
  visible,
}: {
  action?: any;
  visible: boolean;
  handleCancel: (cks?: any[]) => void;
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  if (action) {
    action.needPermission = action.roles.length > 0;
  }

  const [needPermission, setNeedPermission] = useState(false);

  const [apps, setApps] = useState<any[]>([]);

  const getApps = async () => {
    const { data } = await request.get(`${config.apiPrefix}apps`);
    setApps(data);
  };

  const handleOk = async (values: any) => {
    setLoading(true);
    let { roles, permission, name, remarks, app_name } = values;
    const method = action ? 'put' : 'post';
    if (!permission) {
      roles = []
    }
    let payload;
    if (!action) {
      payload = [{ roles, name, remarks, app_name }];
    } else {
      payload = { roles, name, remarks, id: action.id, app_name };
    }
    try {
      const { code, data } = await request[method](
        `${config.apiPrefix}actions`,
        payload,
      );

      if (code === 200) {
        message.success(
          action ? intl.get('更新成功') : intl.get('注册成功'),
        );
        handleCancel(data);
      }
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
    }
  };

  useEffect(() => {
    form.resetFields();
    form.setFieldValue('permission', action ? action.roles.length > 0 : false)
    setNeedPermission(action ? action.roles.length > 0 : false);
    getApps()
  }, [action, visible]);
  const AppsFormItem = ({ form }: { form: FormInstance }) => {
    return (
      <Form.Item
        name="app_name"
        label={intl.get('所属应用')}
        rules={[
          {
            required: true,
          },
        ]}
      >
        <Select
          // mode="single"
          placeholder={intl.get('请选择应用')}
          optionFilterProp="children"
        >
          {apps.map((a: any) => (
            <Select.Option key={a.name} value={a.name} label={a.remarks}>
              {a.name}
            </Select.Option>
          ))}
          </Select>
      </Form.Item>
    );
  };
  const RoleMapFormItem = ({ form }: { form: FormInstance }) => {
    return ( needPermission == true &&
      <Form.Item
        name="roles"
        label={intl.get('授权角色')}
        tooltip={intl.get('无角色即可免权限访问')}
        rules={[
          {
            required: true,
          },
        ]}
      >
        <Select
          mode="multiple"
          placeholder={intl.get('请选择角色名')}
          optionFilterProp="children"
          // onChange={(values) => {
          //   console.log('选择角色', values)
          //   form.setFieldValue("roles", values);
          // }}
        >
          {(Object.keys(config.roleMap)).map((role: any) => (
            <Select.Option key={role} value={role} label={String((config.roleMap as any)[role])}>
              {String((config.roleMap as any)[role])}
            </Select.Option>
          ))}
          </Select>
      </Form.Item>
    );
  };

  return (
    <Modal
      title={action ? intl.get('编辑API') : intl.get('注册API')}
      open={visible}
      forceRender
      centered
      maskClosable={false}
      onOk={() => {
        form
          .validateFields()
          .then((values) => {
            handleOk(values);
          })
          .catch((info) => {
            console.log('Validate Failed:', info);
          });
      }}
      onCancel={() => handleCancel()}
      confirmLoading={loading}
    >
      <Form form={form} layout="vertical" name="action_modal" initialValues={action}>
        <Form.Item
          name="name"
          label={intl.get('名称')}
          tooltip={intl.get('与脚本actions目录下的子目录或文件匹配')}
          rules={[
            {
              required: true,
              message: intl.get('请输入Action名称'),
              whitespace: true,
            },
            {
              pattern: /^[a-zA-Z_][0-9a-zA-Z_\-]*$/,
              message: intl.get('只能输入字母数字下划线，且不能以数字开头'),
            },
          ]}
        >
          <Input placeholder={intl.get('请输入Action名称')} />
        </Form.Item>
        <AppsFormItem form={form} />
        <Form.Item
          name="permission"
          label={intl.get('权限控制')}
          initialValue={false}
          tooltip={intl.get('是否有权限控制')}
        >
          <Radio.Group onChange={(e: RadioChangeEvent) => {
              setNeedPermission(e.target.value)
              console.log("permission", e.target.value)
            }}>
            <Radio value={false}>{intl.get('无')}</Radio>
            <Radio value={true}>{intl.get('有')}</Radio>
          </Radio.Group>
        </Form.Item>
        <RoleMapFormItem form={form} />
        <Form.Item name="remarks" label={intl.get('备注')}>
          <Input placeholder={intl.get('请输入备注')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ActionModal;
