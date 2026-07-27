// User ドメインの公開 API (barrel)。
// 利用側は `import * as User from "~/contexts/user/domain/model"` で読み込み、
// `User.Id` / `User.Name` / `User.Model` / `User.create` のように
// namespace が文脈を与える形で参照する (型名自体は bare)。
export * from "./user";
export * from "./vo/id";
export * from "./vo/name";
export * from "./vo/hashed-password";
