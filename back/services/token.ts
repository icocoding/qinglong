import { Service, Inject } from 'typedi';
import winston, { Container } from 'winston';

import { Token, PermissionType, TokenStatus, TokenModel, TokenInstance } from '../data/token';

import { v4 as uuidV4 } from 'uuid';

@Service()
export default class TokenService {

  constructor(@Inject('logger') private logger: winston.Logger) {}

  public async create(payloads: Token): Promise<Token> {
    payloads.status = TokenStatus.available;
    payloads.token = uuidV4();
    const docs = await this.insert([payloads]);
    return docs[0];
  }

  public async insert(payloads: Token[]): Promise<TokenInstance[]> {
    const result = Array<TokenInstance>();
    for (const action of payloads) {
      const doc = await TokenModel.create(action, { returning: true });
      result.push(doc);
    }
    return result;
  }

  public async expire(ids: string[]) {
    await TokenModel.update(
      { status: TokenStatus.unavailable },
      { where: { id: ids } },
    );
  }

  private async find(query: any, sort: any = []): Promise<TokenInstance[]> {
    const docs = await TokenModel.findAll({
      where: { ...query },
      order: [...sort],
    });
    return docs;
  }

  public async getToken(token: string): Promise<Token> {
    const doc: any = await TokenModel.findOne({ where: { token } });
    return doc && (doc.get({ plain: true }) as Token);
  }

}
