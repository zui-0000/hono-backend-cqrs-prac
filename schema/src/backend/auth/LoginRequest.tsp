import "../../shared/model/index.tsp";
import "../users/model/index.tsp";

@summary("LoginRequest")
model LoginRequest {
  mailAddress: MailAddress;
  password: Password;
}
