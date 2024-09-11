import { Json } from 'sequelize/types/utils';
import { sequelize } from '.';
import { DataTypes, Model, ModelDefined } from 'sequelize';

export class Token {
  id?: number;
  token: string;
  expire_time: number;
  permission_type: PermissionType;
  create_time: number;
  client_ip?: string;
  status: TokenStatus;
  payload: any;

  constructor(options: Token) {
    this.id = options.id;
    this.token = options.token;
    this.permission_type = options.permission_type;
    this.client_ip = options.client_ip;
    this.payload = options.payload;
    this.status =
      typeof options.status === 'number' && TokenStatus[options.status]
        ? options.status
        : TokenStatus.available;
    this.create_time = new Date().getTime();
    this.expire_time = options.expire_time || new Date().getTime() + 24 * 60 * 60 * 1000;
  }
}

export enum PermissionType {
  'App' = 1,
  'User' = 2,
}
export enum TokenStatus {
  'available' = 0,
  'unavailable' = 1,
}
export interface TokenInstance extends Model<Token, Token>, Token { }
export const TokenModel = sequelize.define<TokenInstance>('Token', {
  token: {
    unique: 'compositeIndex',
    type: DataTypes.STRING,
  },
  status: DataTypes.NUMBER,
  create_time: DataTypes.NUMBER,
  expire_time: DataTypes.NUMBER,
  permission_type: DataTypes.NUMBER,
  client_ip: DataTypes.STRING,
  payload: DataTypes.JSON,
}, {
  timestamps: false,
  // freezeTableName: true,
  hooks: {
    beforeCreate: (token: Token) => {
      token.create_time = new Date().getTime();
      token.expire_time = token.expire_time || new Date().getTime() + 24 * 60 * 60 * 1000;
    }
  }
});
