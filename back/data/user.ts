import { sequelize } from '.';
import { DataTypes, Model, ModelDefined } from 'sequelize';

export class User {
  id?: number;
  username: string;
  password: string;
  create_time: number;
  register_ip?: string;
  status: UserStatus;
  roles: string[];
  remarks?: string;
  app_name?: string;

  constructor(options: User) {
    this.id = options.id;
    this.username = options.username;
    this.password = options.password;
    this.register_ip = options.register_ip;
    this.app_name = options.app_name;
    this.status =
      typeof options.status === 'number' && UserStatus[options.status]
        ? options.status
        : UserStatus.normal;
    this.create_time = new Date().getTime();
    this.roles = options.roles || [];
    this.remarks = options.remarks;
  }
}

export enum UserStatus {
  'normal' = 0,
  'disabled' = 1,
}
export interface UserInstance extends Model<User, User>, User { }
export const UserModel = sequelize.define<UserInstance>('User', {
  username: {
    unique: 'compositeIndex',
    type: DataTypes.STRING,
  },
  status: DataTypes.NUMBER,
  create_time: DataTypes.NUMBER,
  password: DataTypes.STRING,
  register_ip: DataTypes.STRING,
  roles: DataTypes.JSON,
  remarks: DataTypes.STRING,
  app_name: DataTypes.STRING,
}, {
  timestamps: false,
  // freezeTableName: true, // false, 表名自动加s
  hooks: {
    beforeCreate: (user: User) => {
      user.create_time = new Date().getTime();
    }
  }
});
