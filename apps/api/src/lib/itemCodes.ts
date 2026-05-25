// 친환경농산물 가격정보 API 품목코드 매핑 테이블
// API 샘플 페이지: api.agromarket.kr/samples/public/ecoFriendly/price
export const ITEM_CODE_MAP: Record<string, {
  item_cd: string;
  ctgry_cd: string;
  ctgry_nm: string;
}> = {
  // 200 채소류
  '배추':      { item_cd: '211', ctgry_cd: '200', ctgry_nm: '채소류' },
  '양배추':    { item_cd: '212', ctgry_cd: '200', ctgry_nm: '채소류' },
  '시금치':    { item_cd: '213', ctgry_cd: '200', ctgry_nm: '채소류' },
  '상추':      { item_cd: '214', ctgry_cd: '200', ctgry_nm: '채소류' },
  '얼갈이배추':{ item_cd: '215', ctgry_cd: '200', ctgry_nm: '채소류' },
  '갓':        { item_cd: '216', ctgry_cd: '200', ctgry_nm: '채소류' },
  '연근':      { item_cd: '217', ctgry_cd: '200', ctgry_nm: '채소류' },
  '우엉':      { item_cd: '218', ctgry_cd: '200', ctgry_nm: '채소류' },
  '양파':      { item_cd: '221', ctgry_cd: '200', ctgry_nm: '채소류' },
  '대파':      { item_cd: '222', ctgry_cd: '200', ctgry_nm: '채소류' },
  '쪽파':      { item_cd: '223', ctgry_cd: '200', ctgry_nm: '채소류' },
  '마늘':      { item_cd: '224', ctgry_cd: '200', ctgry_nm: '채소류' },
  '생강':      { item_cd: '225', ctgry_cd: '200', ctgry_nm: '채소류' },
  '고추':      { item_cd: '231', ctgry_cd: '200', ctgry_nm: '채소류' },
  '피망':      { item_cd: '232', ctgry_cd: '200', ctgry_nm: '채소류' },
  '오이':      { item_cd: '241', ctgry_cd: '200', ctgry_nm: '채소류' },
  '호박':      { item_cd: '242', ctgry_cd: '200', ctgry_nm: '채소류' },
  '애호박':    { item_cd: '242', ctgry_cd: '200', ctgry_nm: '채소류' },
  '토마토':    { item_cd: '243', ctgry_cd: '200', ctgry_nm: '채소류' },
  '가지':      { item_cd: '244', ctgry_cd: '200', ctgry_nm: '채소류' },
  '무':        { item_cd: '251', ctgry_cd: '200', ctgry_nm: '채소류' },
  '당근':      { item_cd: '252', ctgry_cd: '200', ctgry_nm: '채소류' },
  '감자':      { item_cd: '253', ctgry_cd: '200', ctgry_nm: '채소류' },
  '고구마':    { item_cd: '254', ctgry_cd: '200', ctgry_nm: '채소류' },
  '버섯':      { item_cd: '261', ctgry_cd: '200', ctgry_nm: '채소류' },
  '느타리버섯':{ item_cd: '261', ctgry_cd: '200', ctgry_nm: '채소류' },
  '팽이버섯':  { item_cd: '262', ctgry_cd: '200', ctgry_nm: '채소류' },
  '새송이버섯':{ item_cd: '263', ctgry_cd: '200', ctgry_nm: '채소류' },
  '브로콜리':  { item_cd: '271', ctgry_cd: '200', ctgry_nm: '채소류' },
  '콩나물':    { item_cd: '272', ctgry_cd: '200', ctgry_nm: '채소류' },
  '숙주':      { item_cd: '273', ctgry_cd: '200', ctgry_nm: '채소류' },

  // 300 과일류
  '사과':      { item_cd: '311', ctgry_cd: '300', ctgry_nm: '과일류' },
  '배':        { item_cd: '312', ctgry_cd: '300', ctgry_nm: '과일류' },
  '복숭아':    { item_cd: '313', ctgry_cd: '300', ctgry_nm: '과일류' },
  '포도':      { item_cd: '314', ctgry_cd: '300', ctgry_nm: '과일류' },
  '딸기':      { item_cd: '321', ctgry_cd: '300', ctgry_nm: '과일류' },
  '수박':      { item_cd: '322', ctgry_cd: '300', ctgry_nm: '과일류' },
  '참외':      { item_cd: '323', ctgry_cd: '300', ctgry_nm: '과일류' },
  '멜론':      { item_cd: '324', ctgry_cd: '300', ctgry_nm: '과일류' },
  '바나나':    { item_cd: '331', ctgry_cd: '300', ctgry_nm: '과일류' },
  '키위':      { item_cd: '332', ctgry_cd: '300', ctgry_nm: '과일류' },
  '레몬':      { item_cd: '333', ctgry_cd: '300', ctgry_nm: '과일류' },
  '오렌지':    { item_cd: '334', ctgry_cd: '300', ctgry_nm: '과일류' },
  '귤':        { item_cd: '341', ctgry_cd: '300', ctgry_nm: '과일류' },
  '감':        { item_cd: '342', ctgry_cd: '300', ctgry_nm: '과일류' },
  '자두':      { item_cd: '343', ctgry_cd: '300', ctgry_nm: '과일류' },
  '체리':      { item_cd: '344', ctgry_cd: '300', ctgry_nm: '과일류' },
  '블루베리':  { item_cd: '345', ctgry_cd: '300', ctgry_nm: '과일류' },
  '아보카도':  { item_cd: '346', ctgry_cd: '300', ctgry_nm: '과일류' },
  '망고':      { item_cd: '347', ctgry_cd: '300', ctgry_nm: '과일류' },

  // 400 축산물
  '돼지고기':  { item_cd: '411', ctgry_cd: '400', ctgry_nm: '축산물' },
  '소고기':    { item_cd: '412', ctgry_cd: '400', ctgry_nm: '축산물' },
  '닭고기':    { item_cd: '413', ctgry_cd: '400', ctgry_nm: '축산물' },
  '달걀':      { item_cd: '421', ctgry_cd: '400', ctgry_nm: '축산물' },
  '계란':      { item_cd: '421', ctgry_cd: '400', ctgry_nm: '축산물' },
  '우유':      { item_cd: '431', ctgry_cd: '400', ctgry_nm: '축산물' },

  // 500 수산물
  '고등어':    { item_cd: '511', ctgry_cd: '500', ctgry_nm: '수산물' },
  '갈치':      { item_cd: '512', ctgry_cd: '500', ctgry_nm: '수산물' },
  '오징어':    { item_cd: '513', ctgry_cd: '500', ctgry_nm: '수산물' },
  '새우':      { item_cd: '514', ctgry_cd: '500', ctgry_nm: '수산물' },
  '조개':      { item_cd: '515', ctgry_cd: '500', ctgry_nm: '수산물' },
  '굴':        { item_cd: '516', ctgry_cd: '500', ctgry_nm: '수산물' },
  '꽃게':      { item_cd: '517', ctgry_cd: '500', ctgry_nm: '수산물' },
  '참치':      { item_cd: '518', ctgry_cd: '500', ctgry_nm: '수산물' },
  '연어':      { item_cd: '519', ctgry_cd: '500', ctgry_nm: '수산물' },
};

// 식재료명으로 품목코드 조회
export const getItemCode = (name: string) => {
  // 정확한 매칭
  if (ITEM_CODE_MAP[name]) return ITEM_CODE_MAP[name];

  // 부분 매칭 (예: "대파 1단" → "대파")
  const match = Object.keys(ITEM_CODE_MAP).find(key => name.includes(key));
  if (match) return ITEM_CODE_MAP[match];

  return null;
};