import { Effect, Option } from "effect";
import type { MailAddress } from "~/shared/domain/mail-address";
import { MailAddressAlreadyExistsError } from "~/shared/error/mail-address-already-exists-error";
import type { RepositoryError } from "~/shared/error/repository-error";
import type { UserId } from "./model/vo/user-id";
import { UserRepository } from "./user-repository";

/**
 * 「同じメールアドレスのユーザーは 2 人存在しない」という業務ルール (ドメインサービス)。
 *
 * User 集約 1 つを見ても「他に同じメールアドレスの人が居るか」は判断できないため、
 * 集約にも値オブジェクトにも属さない。こうした集約をまたぐ不変条件を担うのが
 * ドメインサービス。ルールに名前を与えて 1 箇所に置き、
 * 呼ぶ順序 (= ユースケースの手順) だけを command 側に残す。
 *
 * ドメインに置きつつリポジトリを読むが、依存するのは domain/ にあるポートだけで
 * 実装 (Drizzle) は知らないため、層の向きは内向きのまま保たれる。
 * I/O を伴うことは戻り値の R (UserRepository) に現れる。
 *
 * なお、これは事前チェックであって強制ではない。同時実行 (TOCTOU) ですり抜けた場合は
 * DB の unique 制約が最後の砦となり、infrastructure が同じエラーへ翻訳する。
 *
 * @param excluding 除外するユーザー。更新時に「自分自身がヒットしただけ」を
 *   重複と誤判定しないために渡す (メールアドレスを変えない更新)。
 */
export const ensureMailAddressIsUnique = (
  mailAddress: MailAddress,
  options: { readonly excluding?: UserId } = {},
): Effect.Effect<
  void,
  MailAddressAlreadyExistsError | RepositoryError,
  UserRepository
> =>
  Effect.gen(function* () {
    const userRepository = yield* UserRepository;
    const owner = yield* userRepository.findByMailAddress(mailAddress);

    // 誰も使っていない、または使っているのが除外対象本人なら重複ではない。
    if (Option.isNone(owner) || owner.value.id === options.excluding) return;

    return yield* new MailAddressAlreadyExistsError({ mailAddress });
  });
