"use client";

// 회원 관리 목록의 검색/필터/정렬 바. 상태는 전부 URL 쿼리(searchParams)에 두고 서버 컴포넌트
// (page.tsx)가 그걸 읽어 조회한다 — 새로고침/링크 공유해도 같은 화면이 나오게. 셀렉트는 바꾸는
// 즉시 반영하고, 검색어는 엔터로 반영. 조건이 바뀌면 page는 1로 되돌린다.
import { useRouter, useSearchParams } from "next/navigation";
import { field } from "@/components/ui/styles";

const selectClass =
  "rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-black focus:outline-none";

export function MemberFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q");
          update("q", typeof q === "string" ? q.trim() : "");
        }}
      >
        <input
          type="text"
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="이름, 닉네임, 이메일, #태그로 검색"
          className={field}
        />
      </form>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="유형"
          className={selectClass}
          value={params.get("type") ?? ""}
          onChange={(e) => update("type", e.target.value)}
        >
          <option value="">유형 전체</option>
          <option value="student">전공생</option>
          <option value="activist">활동자</option>
          <option value="none">미설정</option>
        </select>
        <select
          aria-label="권한"
          className={selectClass}
          value={params.get("role") ?? ""}
          onChange={(e) => update("role", e.target.value)}
        >
          <option value="">권한 전체</option>
          <option value="admin">관리자</option>
          <option value="user">일반</option>
        </select>
        <select
          aria-label="가입 기간"
          className={selectClass}
          value={params.get("joined") ?? ""}
          onChange={(e) => update("joined", e.target.value)}
        >
          <option value="">가입 기간 전체</option>
          <option value="7">최근 7일 가입</option>
          <option value="30">최근 30일 가입</option>
        </select>
        <select
          aria-label="활동"
          className={selectClass}
          value={params.get("seen") ?? ""}
          onChange={(e) => update("seen", e.target.value)}
        >
          <option value="">활동 전체</option>
          <option value="7">최근 7일 활동</option>
          <option value="30">최근 30일 활동</option>
          <option value="dormant">30일 이상 미접속</option>
        </select>
        <select
          aria-label="정렬"
          className={selectClass}
          value={params.get("sort") ?? ""}
          onChange={(e) => update("sort", e.target.value)}
        >
          <option value="">최근 가입순</option>
          <option value="joined_asc">오래된 가입순</option>
          <option value="seen">최근 활동순</option>
          <option value="name">이름순</option>
        </select>
      </div>
    </div>
  );
}
