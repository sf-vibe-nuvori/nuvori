/*
 * Nuvori 모바일 더미 데이터
 * 구조는 contracts/inventory-state.schema.json 계약을 따른다 (필수 필드 전부 포함).
 * 실제 앱에서는 AsyncStorage 등 영구 저장소에 이 계약 구조로 저장한다.
 * boughtDay는 dayOffset 기준 상대 구매일이며, 경과일 = dayOffset - boughtDay 로 계산한다.
 */

// web/index.html의 RECIPES와 동일한 요리 목록 (재료 키워드 매칭용)
var RECIPES = [
  { id: "recipe_egg_ramen", name: "계란 라면", emoji: "🍜", ingredients: ["라면", "계란"] },
  { id: "recipe_olive_pasta", name: "올리브유 파스타", emoji: "🍝", ingredients: ["파스타", "올리브유"] },
  { id: "recipe_spinach_pasta", name: "시금치 파스타", emoji: "🥬", ingredients: ["파스타", "올리브유", "시금치"] },
  { id: "recipe_tofu_jorim", name: "두부조림", emoji: "🍛", ingredients: ["두부", "간장"] },
  { id: "recipe_tofu_steak", name: "두부 스테이크", emoji: "🥩", ingredients: ["두부", "올리브유", "간장"] },
  { id: "recipe_spinach_egg", name: "시금치 계란볶음", emoji: "🍳", ingredients: ["시금치", "계란"] },
  { id: "recipe_scrambled_egg", name: "우유 스크램블 에그", emoji: "🍳", ingredients: ["계란", "우유"] },
  { id: "recipe_kimchi_fried_rice", name: "김치볶음밥", emoji: "🍚", ingredients: ["김치", "쌀", "계란"] },
  { id: "recipe_tofu_kimchi", name: "두부김치", emoji: "🍲", ingredients: ["두부", "김치"] },
  { id: "recipe_doenjang_stew", name: "된장찌개", emoji: "🍲", ingredients: ["된장", "두부", "애호박", "양파"] },
  { id: "recipe_milk_cream_soup", name: "우유 크림스프", emoji: "🥣", ingredients: ["우유", "양파", "감자"] }
];

// inventory-state.schema.json 계약 준수 더미 상태
var dummyState = {
  subMode: "inventory",
  recipeMode: "list",
  dayOffset: 9,
  items: [
    {
      id: "item_001",
      thumbKey: "egg",
      name: "계란",
      price: 6.49,
      lastStore: "Trader Joe's",
      lastPurchaseDate: "2026-11-23",
      cycleDays: 14,
      boughtDay: 7, // 경과 2일
      manualNeedToBuy: false,
      isManuallyAdded: false,
      checkedForOrder: false
    },
    {
      id: "item_002",
      thumbKey: "milk",
      name: "우유",
      price: 4.29,
      lastStore: "Trader Joe's",
      lastPurchaseDate: "2026-11-14",
      cycleDays: 7,
      boughtDay: -2, // 경과 11일 → 부족
      manualNeedToBuy: false,
      isManuallyAdded: false,
      checkedForOrder: false
    },
    {
      id: "item_003",
      thumbKey: "tofu",
      name: "두부",
      price: 2.99,
      lastStore: "H-Mart",
      lastPurchaseDate: "2026-11-21",
      cycleDays: 10,
      boughtDay: 5, // 경과 4일
      manualNeedToBuy: false,
      isManuallyAdded: false,
      checkedForOrder: false
    },
    {
      id: "item_004",
      thumbKey: "spinach",
      name: "시금치",
      price: 3.49,
      lastStore: "H-Mart",
      lastPurchaseDate: "2026-11-19",
      cycleDays: 5,
      boughtDay: 3, // 경과 6일 → 부족
      manualNeedToBuy: false,
      isManuallyAdded: false,
      checkedForOrder: false
    },
    {
      id: "item_005",
      thumbKey: "kimchi",
      name: "김치",
      price: 8.99,
      lastStore: "H-Mart",
      lastPurchaseDate: "2026-11-16",
      cycleDays: 21,
      boughtDay: 0, // 경과 9일
      manualNeedToBuy: false,
      isManuallyAdded: false,
      checkedForOrder: false
    },
    {
      id: "item_006",
      thumbKey: "rice",
      name: "쌀",
      price: 15.99,
      lastStore: "H-Mart",
      lastPurchaseDate: "2026-11-09",
      cycleDays: 60,
      boughtDay: -7, // 경과 16일
      manualNeedToBuy: false,
      isManuallyAdded: false,
      checkedForOrder: false
    },
    {
      id: "item_007",
      thumbKey: "soysauce",
      name: "간장",
      price: 5.49,
      lastStore: "H-Mart",
      lastPurchaseDate: "2026-11-10",
      cycleDays: 90,
      boughtDay: -6, // 경과 15일
      manualNeedToBuy: false,
      isManuallyAdded: false,
      checkedForOrder: false
    },
    {
      id: "item_008",
      name: "된장",
      price: 7.99,
      cycleDays: 90,
      boughtDay: -6, // 경과 15일
      lastPurchaseDate: "2026-11-10",
      manualNeedToBuy: true, // 수동 구매 플래그 → 🛒 사야 한다
      isManuallyAdded: true, // 직접 추가 품목 (경과일 대신 "직접 추가됨" 표시)
      checkedForOrder: false
    }
  ],
  receipts: [
    {
      id: "receipt_001",
      storeName: "Trader Joe's",
      purchaseDate: "2026-11-23",
      addedItemIds: ["item_001"],
      prevItemMap: {
        item_001: {
          id: "item_001",
          name: "계란",
          price: 5.99,
          cycleDays: 14,
          boughtDay: -9,
          lastPurchaseDate: "2026-11-09"
        }
      },
      items: [
        { id: "ri_001", name: "계란", price: 6.49, cycleDays: 14 },
        { id: "ri_002", name: "방울토마토", price: 3.99, cycleDays: 7 }
      ]
    },
    {
      id: "receipt_002",
      storeName: "H-Mart",
      purchaseDate: "2026-11-21",
      addedItemIds: ["item_003"],
      items: [
        { id: "ri_003", name: "두부", price: 2.99, cycleDays: 10 },
        { id: "ri_004", name: "시금치", price: 3.49, cycleDays: 5 }
      ]
    }
  ]
};

export { dummyState, RECIPES };
