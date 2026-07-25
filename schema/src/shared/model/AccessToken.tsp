@summary("AccessToken")
@doc("アクセストークン(JWT想定)。認可に使用する。")
@example("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIiwiaWF0IjoxNzM1NzE4NDAwfQ.srCq5l7u2mKq8eM4X4g5wqVd5J9Jw7V0q1c2d3e4f5g")
@minLength(20)
@maxLength(2048)
// NOTE: JWT全体の厳密な検証は難しいため、3セグメント形式だけ軽く保証する
@pattern("^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$")
scalar AccessToken extends string;
