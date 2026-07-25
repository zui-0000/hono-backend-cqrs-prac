import "./model/index.tsp";
import "../../shared/model/index.tsp";

@summary("CreateUserRequest")
model CreateUserRequest {
  name: UserName;
  mailAddress: MailAddress;
  password: Password;
}
