/**
 * Nuvori 모바일 앱 (Expo / React Native) — 스캐폴드
 *
 * 구조는 web PWA를 참고: 하단 2개 메인 탭 (🥬 인벤토리 | 🍳 레시피).
 * web의 인벤토리 내부 토글(인벤토리/쇼핑/영수증/챗)은 최소 구현에서는 생략하고
 * 인벤토리 탭은 품목 리스트(이름 + 경과일 + 3종 배지)만 노출한다.
 *
 * UI 단순성 규칙 (web/CLAUDE.md와 동일):
 *   - 퍼센트 게이지바 / 수동 재고 확인 버튼 / 카테고리 태그 금지
 *   - 배지는 오직 3종: ⚠️ 부족하다 / ✅ 안 사도 된다 / 🛒 사야 한다
 *
 * 상태 구조는 contracts/inventory-state.schema.json 계약, 데이터는 src/data.js 더미.
 * HSMM 예측 엔진(model/hsmm-engine.js)은 아직 연동하지 않았다 —
 * 배지 판정은 스캐폴드용 단순 규칙(경과일 >= 소비주기 → 부족)을 쓴다.
 */

import React, { useState } from "react";
import { StyleSheet, Text, View, FlatList, SafeAreaView, StatusBar } from "react-native";
import { dummyState, RECIPES } from "./src/data";

// ---------- 공통 유틸 ----------

function normalizeFoodName(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "");
}

// web/index.html의 formatDaysAgo와 동일한 문구
function formatDaysAgo(item, elapsed) {
  if (item.isManuallyAdded) return "직접 추가됨";
  if (elapsed <= 0) return "오늘 구매";
  return "산 지 " + elapsed + "일 됨";
}

function elapsedDays(item, dayOffset) {
  return dayOffset - item.boughtDay;
}

// 스캐폴드용 배지 판정 (3종 고정).
// HSMM 엔진 연동 후에는 model/hsmm-engine.js의 evaluateItemForOffset로 대체한다.
function badgeFor(item, dayOffset) {
  if (item.manualNeedToBuy) {
    return { emoji: "🛒", text: "사야 한다", style: styles.badgeBuy };
  }
  var elapsed = elapsedDays(item, dayOffset);
  if (elapsed >= item.cycleDays) {
    return { emoji: "⚠️", text: "부족하다", style: styles.badgeShort };
  }
  return { emoji: "✅", text: "안 사도 된다", style: styles.badgeSkip };
}

function isShort(item, dayOffset) {
  return Boolean(item.manualNeedToBuy) || elapsedDays(item, dayOffset) >= item.cycleDays;
}

// ---------- 인벤토리 탭 ----------

function InventoryScreen() {
  var dayOffset = dummyState.dayOffset;
  return (
    <FlatList
      style={styles.list}
      data={dummyState.items}
      keyExtractor={function (item) { return item.id; }}
      renderItem={function (_a) {
        var item = _a.item;
        var elapsed = elapsedDays(item, dayOffset);
        var badge = badgeFor(item, dayOffset);
        return (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDays}>{formatDaysAgo(item, elapsed)}</Text>
            </View>
            <Text style={[styles.badge, badge.style]}>
              {badge.emoji} {badge.text}
            </Text>
          </View>
        );
      }}
    />
  );
}

// ---------- 레시피 탭 ----------

// web/index.html의 findInventoryItemForIngredient와 동일한 양방향 포함 매칭
function findInventoryItemForIngredient(keyword, items) {
  var k = normalizeFoodName(keyword);
  if (!k) return null;
  for (var i = 0; i < items.length; i++) {
    var n = normalizeFoodName(items[i].name);
    if (n.indexOf(k) !== -1 || k.indexOf(n) !== -1) {
      return items[i];
    }
  }
  return null;
}

function getRecipeMatches(items, dayOffset) {
  var matches = [];
  for (var i = 0; i < RECIPES.length; i++) {
    var rc = RECIPES[i];
    var inStock = [];
    var missing = [];
    for (var j = 0; j < rc.ingredients.length; j++) {
      var found = findInventoryItemForIngredient(rc.ingredients[j], items);
      if (!found) {
        missing.push({ name: rc.ingredients[j], status: "없음" });
      } else if (isShort(found, dayOffset)) {
        missing.push({ name: rc.ingredients[j], status: "부족" });
      } else {
        inStock.push(found.name);
      }
    }
    matches.push({ recipe: rc, inStock: inStock, missing: missing });
  }
  return matches;
}

function RecipeCard(_a) {
  var match = _a.match;
  var makeable = match.missing.length === 0;
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.itemName}>
          {match.recipe.emoji} {match.recipe.name}
        </Text>
        <Text style={styles.itemDays}>
          {makeable
            ? "재료가 모두 있어요"
            : "재료 " + match.missing.length + "개 부족: " +
              match.missing.map(function (m) { return m.name + "(" + m.status + ")"; }).join(", ")}
        </Text>
      </View>
      <Text style={[styles.badge, makeable ? styles.badgeSkip : styles.badgeShort]}>
        {makeable ? "✅ 만들 수 있음" : "⚠️ 부족"}
      </Text>
    </View>
  );
}

function RecipeScreen() {
  var dayOffset = dummyState.dayOffset;
  var matches = getRecipeMatches(dummyState.items, dayOffset);
  var makeable = matches.filter(function (m) { return m.missing.length === 0; });
  var nearMiss = matches
    .filter(function (m) { return m.missing.length > 0; })
    .sort(function (a, b) { return a.missing.length - b.missing.length; });
  return (
    <FlatList
      style={styles.list}
      data={makeable.concat(nearMiss)}
      keyExtractor={function (match) { return match.recipe.id; }}
      ListHeaderComponent={
        <View>
          <Text style={styles.sectionHeader}>
            ✅ 지금 만들 수 있는 요리 ({makeable.length}개)
          </Text>
          {makeable.length === 0 ? (
            <Text style={styles.emptyText}>재료가 갖춰진 요리가 없어요.</Text>
          ) : null}
          {nearMiss.length > 0 ? (
            <Text style={styles.sectionHeader}>
              ⚠️ 재료가 조금 부족한 요리 ({nearMiss.length}개)
            </Text>
          ) : null}
        </View>
      }
      renderItem={function (_a) { return <RecipeCard match={_a.item} />; }}
    />
  );
}

// ---------- 앱 셸 (하단 2탭) ----------

var TABS = [
  { key: "inventory", label: "🥬 인벤토리" },
  { key: "recipes", label: "🍳 레시피" }
];

export default function App() {
  var _useState = useState("inventory");
  var tab = _useState[0];
  var setTab = _useState[1];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Nuvori</Text>
      <View style={styles.screen}>
        {tab === "inventory" ? <InventoryScreen /> : <RecipeScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map(function (t) {
          var active = tab === t.key;
          return (
            <Text
              key={t.key}
              style={[styles.tabButton, active ? styles.tabActive : null]}
              onPress={function () { setTab(t.key); }}
            >
              {t.label}
            </Text>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ---------- 스타일 ----------

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 12
  },
  screen: { flex: 1 },
  list: { flex: 1, paddingHorizontal: 16 },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8
  },
  emptyText: { fontSize: 14, color: "#999", marginBottom: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5"
  },
  cardLeft: { flex: 1, paddingRight: 8 },
  itemName: { fontSize: 16, fontWeight: "600" },
  itemDays: { fontSize: 13, color: "#888", marginTop: 2 },
  badge: { fontSize: 13, fontWeight: "600", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  badgeShort: { backgroundColor: "#fdecec", color: "#c0392b" },
  badgeSkip: { backgroundColor: "#e8f6ee", color: "#1e8e5a" },
  badgeBuy: { backgroundColor: "#fff3dc", color: "#b07d1a" },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    paddingBottom: 8
  },
  tabButton: {
    flex: 1,
    fontSize: 16,
    textAlign: "center",
    paddingVertical: 10,
    color: "#999"
  },
  tabActive: { color: "#1e8e5a", fontWeight: "700" }
});
