// User ドメインの公開 API (barrel)。
// 利用側は `import * as User from "~/features/user/domain"` で読み込み、
// `User.Id` / `User.Name` / `User.create` / `User.Repository` のように
// namespace が文脈を与える形で参照する (型名自体は bare)。
export * from "./model/user";
export * from "./model/vo/id";
export * from "./model/vo/name";
export * from "./model/vo/hashed-password";
export * from "./repository";
