import "./model/index.tsp";
import "../../shared/model/index.tsp";

@summary("GetUserResult")
model GetUserResult {
  name: UserName;
  mailAddress: MailAddress;
}
