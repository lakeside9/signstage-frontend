// 완료 효과(축하 효과) 전용 공용 팔레트.
// 채도를 낮춘 골드/파스텔 톤으로 통일해, 격식 있는 행사 메인 화면에 어울리는
// 고급스러운 인상을 모든 효과가 동일하게 유지하도록 한다.
// 효과별로 색상 배열을 따로 하드코딩하지 말고 이 팔레트를 참조할 것.
export const CELEBRATION_PALETTE = [
  '#f4cf68', // warm gold
  '#d8a742', // deep gold
  '#fff3bf', // pale champagne
  '#c7b9f4', // soft lavender
  '#8fc8d8', // muted teal
  '#dfa69d', // dusty rose
  '#9fc6a7', // sage
] as const;
