import { Base } from './base';
import { Session } from './session';
import { Token } from './token';
import { User } from './user';
import { applyMixins } from './utils';

class KycDao extends Base {}
interface KycDao extends Session, Token, User {}
applyMixins(KycDao, [Session, Token, User]);

export default KycDao;
