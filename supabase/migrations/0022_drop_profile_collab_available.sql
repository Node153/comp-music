-- profiles.collab_available("협업 가능" 체크박스)는 프로필 화면에 배지 표시 말고는 아무
-- 기능이 없었다(검색/필터/게이팅 전혀 없음). posts.collab_available(0012~0016, Complex
-- 채팅 작업물 업로드 권한을 실제로 제어)과 이름이 같아 혼동만 유발해서 제거한다.
alter table profiles drop column collab_available;
