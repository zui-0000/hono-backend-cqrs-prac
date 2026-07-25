import "./model/index.tsp";
import "../../shared/model/index.tsp";

@summary("UpdateUserRequest")
model UpdateUserRequest {
  name: UserName;
  mailAddress: MailAddress;
}
