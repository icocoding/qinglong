import React, { useEffect, useState } from 'react';
import { Modal, message, Input, Form, Radio, Select, RadioChangeEvent, type FormInstance } from 'antd';
import { request } from '@/utils/http';
import config from '@/utils/config';
import intl from '@/utils/intl'


const UserAModal = ({
  user,
  handleCancel,
  visible,
}: {
  user?: any;
  visible: boolean;
  handleCancel: (cks?: any[]) => void;
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [apps, setApps] = useState<any[]>([]);

  const getApps = async () => {
    const { data } = await request.get(`${config.apiPrefix}apps`);
    setApps(data);
  };

  const handleOk = async (values: any) => {
    setLoading(true);
    let { roles, username, password, remarks, app_name } = values;
    const method = user ? 'put' : 'post';
 
    let payload;
    if (!user) {
      payload = [{ roles, username, password, remarks, app_name }];
    } else {
      payload = { roles, remarks, id: user.id, app_name };
    }
    try {
      const { code, data } = await request[method](
        `${config.apiPrefix}users`,
        payload,
      );

      if (code === 200) {
        message.success(
          user ? intl.get('更新成功') : intl.get('注册成功'),
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
    getApps();
  }, [user, visible]);

  const RoleMapFormItem = ({ form }: { form: FormInstance }) => {
    return (
      <Form.Item
        name="roles"
        label={intl.get('授权角色')}
        tooltip={intl.get('用户角色, 根据角色授权接口')}
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
  function PasswordFormItem({ form } : { form: FormInstance } ) {
    return ( !user &&
      <Form.Item
        name="password"
        label={intl.get('初始密码')}
        rules={[
          {
            required: true,
          },
        ]}
      >
        <Input placeholder={intl.get('请输入密码')} type='password' autoComplete='new-password' />
      </Form.Item>
    );
  }
  return (
    <Modal
      title={user ? intl.get('编辑用户') : intl.get('注册用户')}
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
      <Form form={form} layout="vertical" name="user_modal" initialValues={user} autoComplete='off'>
        <Form.Item
          name="username"
          label={intl.get('用户名')}
          rules={[
            {
              required: true,
              message: intl.get('请输入用户名'),
              whitespace: true,
            },
            {
              pattern: /^[a-zA-Z_][0-9a-zA-Z_\-]*$/,
              message: intl.get('只能输入字母数字下划线，且不能以数字开头'),
            },
          ]}
        >
          <Input placeholder={intl.get('请输入用户名')} readOnly={!!user} />
        </Form.Item>
        <PasswordFormItem form={form} />
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
        <RoleMapFormItem form={form} />
        <Form.Item name="remarks" label={intl.get('备注')}>
          <Input placeholder={intl.get('请输入备注')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UserAModal;
