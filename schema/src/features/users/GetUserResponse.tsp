import "./model/index.tsp";
import "../../shared/model/index.tsp";

@summary("GetUserResponse")
model GetUserResponse {
  name: UserName;
  mailAddress: MailAddress;
}
