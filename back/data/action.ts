import { sequelize } from '.';
import { DataTypes, Model, ModelDefined } from 'sequelize';

export class Action {
  app_name: string;
  name: string;
  remarks?: string;
  timestamp?: string;
  id?: number;
  status?: ActionStatus;
  roles: string[];

  constructor(options: Action) {
    this.id = options.id;
    this.app_name = options.app_name;
    this.timestamp = new Date().toString();
    this.name = options.name;
    this.remarks = options.remarks;
    this.roles = options.roles || [];
  }
}

export enum ActionStatus {
  'normal',
  'disabled',
}

export const maxPosition = 9000000000000000;
export const initPosition = 4500000000000000;
export const stepPosition = 10000000000;
export const minPosition = 100;

export interface ActionInstance extends Model<Action, Action>, Action {}
export const ActionModel = sequelize.define<ActionInstance>('Action', {
  timestamp: DataTypes.STRING,
  status: DataTypes.NUMBER,
  name: { type: DataTypes.STRING, unique: 'compositeIndex' },
  remarks: DataTypes.STRING,
  roles: DataTypes.JSON,
  app_name: { type: DataTypes.STRING, unique: 'compositeIndex' },
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
});
