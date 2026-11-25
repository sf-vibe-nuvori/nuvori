import math
import random
import json
from dataclasses import dataclass
from typing import Dict, List

random.seed(42)

@dataclass
class CategoryPrior:
    name: str
    ko_name: str
    mean_days_to_deplete: float   # USDA / FDA / FoodKeeper population mean depletion time (days)
    cv_household: float           # Cross-household heterogeneity (coeff of variation)
    daily_noise_cv: float         # Day-to-day consumption volatility within household
    prob_buy_when_depleted: float # P(O_t = 1 | S_0 on shopping day)
    prob_impulse_buy_normal: float # P(O_t = 1 | S_1 on shopping day - early stock-up)
    recipe_use_freq_weekly: float # Probability this item is needed in a given week's meal plan
    stockout_cost: float          # Cost ($) of missing ingredient needed for a planned dinner
    overbuy_cost: float           # Cost ($) of buying duplicate when already in stock
    query_cost: float             # Cognitive friction cost ($) of asking user 1 binary check at checkout

CATEGORIES = [
    CategoryPrior(
        name="fast_staple_eggs_milk",
        ko_name="고빈도 필수재 (계란 12구·우유)",
        mean_days_to_deplete=10.5,
        cv_household=0.35,
        daily_noise_cv=0.30,
        prob_buy_when_depleted=0.88,
        prob_impulse_buy_normal=0.06,
        recipe_use_freq_weekly=0.85,
        stockout_cost=25.0,
        overbuy_cost=3.5,
        query_cost=0.60,
    ),
    CategoryPrior(
        name="med_staple_pasta_ramen",
        ko_name="중빈도 다용도실 주식 (파스타·라면·양파)",
        mean_days_to_deplete=24.0,
        cv_household=0.45,
        daily_noise_cv=0.40,
        prob_buy_when_depleted=0.68,
        prob_impulse_buy_normal=0.04,
        recipe_use_freq_weekly=0.50,
        stockout_cost=18.0,
        overbuy_cost=2.5,
        query_cost=0.60,
    ),
    CategoryPrior(
        name="slow_condiment_oil_sauce",
        ko_name="저빈도 상비 조미료 (식용유·간장·올리브유)",
        mean_days_to_deplete=60.0,
        cv_household=0.40,
        daily_noise_cv=0.25,
        prob_buy_when_depleted=0.82,
        prob_impulse_buy_normal=0.03,
        recipe_use_freq_weekly=0.95,
        stockout_cost=30.0,
        overbuy_cost=4.0,
        query_cost=0.60,
    ),
    CategoryPrior(
        name="episodic_dried_squid_specialty",
        ko_name="비정기 기호/특수식 (마른오징어·코코넛밀크)",
        mean_days_to_deplete=42.0,
        cv_household=0.65,
        daily_noise_cv=0.75,
        prob_buy_when_depleted=0.12, # Crucial: when depleted, user rarely auto-rebuys!
        prob_impulse_buy_normal=0.02,
        recipe_use_freq_weekly=0.20,
        stockout_cost=15.0,
        overbuy_cost=5.0,
        query_cost=0.60,
    ),
]

def quantity_to_state(q: float) -> int:
    # 2 = Surplus (잉여: > 60%), 1 = Normal (정상 소비: 15% - 60%), 0 = Depleted (부족: <= 15%)
    if q > 0.60:
        return 2
    elif q > 0.15:
        return 1
    else:
        return 0

def mat_vec_mul(b: List[float], T: List[List[float]]) -> List[float]:
    return [
        b[0]*T[0][j] + b[1]*T[1][j] + b[2]*T[2][j]
        for j in range(3)
    ]

def normalize(v: List[float]) -> List[float]:
    s = sum(v)
    if s <= 1e-12:
        return [1.0/3, 1.0/3, 1.0/3]
    return [x / s for x in v]

def argmax(v: List[float]) -> int:
    best_i = 0
    best_v = v[0]
    for i in range(1, len(v)):
        if v[i] > best_v:
            best_v = v[i]
            best_i = i
    return best_i

def build_memoryless_transition(expected_deplete_days: float) -> List[List[float]]:
    d2 = max(1.2, 0.47 * expected_deplete_days)
    d1 = max(1.2, 0.53 * expected_deplete_days)
    p21 = 1.0 / d2
    p10 = 1.0 / d1
    return [
        [0.998, 0.002, 0.0],
        [p10, 1.0 - p10, 0.0],
        [0.0, p21, 1.0 - p21],
    ]

def build_hsmm_age_transition(days_elapsed: float, expected_deplete_days: float, cv: float) -> List[List[float]]:
    def state_probs_at_day(tau: float) -> List[float]:
        if tau <= 0:
            return [0.001, 0.009, 0.990]
        mu_q = 1.0 - 0.85 * (tau / max(2.0, expected_deplete_days))
        sig_q = max(0.05, min(0.35, 0.85 * cv * math.sqrt(tau / max(2.0, expected_deplete_days)) + 0.04))
        p0 = 0.5 * (1.0 + math.erf((0.15 - mu_q) / (sig_q * math.sqrt(2.0))))
        p01 = 0.5 * (1.0 + math.erf((0.60 - mu_q) / (sig_q * math.sqrt(2.0))))
        p1 = max(1e-4, p01 - p0)
        p2 = max(1e-4, 1.0 - p01)
        return normalize([p0, p1, p2])

    pi_prev = state_probs_at_day(max(0.0, days_elapsed - 1.0))
    pi_curr = state_probs_at_day(days_elapsed)

    h21 = max(0.005, min(0.85, 1.0 - (pi_curr[2] / max(1e-5, pi_prev[2]))))
    inflow_s0 = max(0.0, pi_curr[0] - pi_prev[0])
    h10 = max(0.005, min(0.85, inflow_s0 / max(1e-4, pi_prev[1])))

    return [
        [0.998, 0.002, 0.0],
        [h10, 1.0 - h10, 0.0],
        [0.0, h21, 1.0 - h21],
    ]

def emission_probs(cat: CategoryPrior, is_shopping_day: bool) -> List[float]:
    if not is_shopping_day:
        return [0.01, 0.001, 0.0002]
    return [
        cat.prob_buy_when_depleted,
        cat.prob_impulse_buy_normal,
        0.005,
    ]

def simulate_category(cat: CategoryPrior, n_households: int = 300, n_days: int = 365):
    methods = [
        "1_pop_memoryless_hmm",
        "2_hier_memoryless_hmm",
        "3_hier_hsmm_map",
        "4_hier_hsmm_asymmetric_loss",
        "5_pomdp_active_evsi",
        "6_entropy_aware_recipe_avoidance",
    ]
    stats = {
        m: {
            "correct_3state": 0,
            "correct_s0_binary": 0,
            "brier_sum": 0.0,
            "stockout_events": 0,
            "overbuy_events": 0,
            "queries_asked": 0,
            "total_checks": 0,
            "total_loss_usd": 0.0,
        }
        for m in methods
    }

    cycle_acc = {k: [] for k in range(1, 9)}

    for h in range(n_households):
        sigma_h = math.sqrt(math.log(1.0 + cat.cv_household**2))
        mu_h = -0.5 * sigma_h**2
        true_velocity = random.lognormvariate(mu_h, sigma_h)
        true_deplete_days = cat.mean_days_to_deplete / true_velocity
        mean_daily_use = 0.85 / true_deplete_days

        q = 1.0
        last_purchase_day = 0
        pomdp_age_discount = 0.0
        observed_deplete_estimates: List[float] = []

        b_pop = [0.0, 0.0, 1.0]
        b_hier_hmm = [0.0, 0.0, 1.0]
        b_hsmm = [0.0, 0.0, 1.0]
        b_pomdp = [0.0, 0.0, 1.0]

        cum_s0_days_in_cycle = 0.0
        prior_weight = 2.0
        est_deplete_days = cat.mean_days_to_deplete
        est_cv = cat.cv_household

        for t in range(1, n_days + 1):
            is_shopping_day = (t % 7 == 0)

            shock = 2.4 if (random.random() < 0.03) else 1.0
            daily_consume = max(0.0, random.gauss(mean_daily_use * shock, mean_daily_use * cat.daily_noise_cv))
            q = max(0.0, q - daily_consume)
            true_s = quantity_to_state(q)

            p_emit_true = emission_probs(cat, is_shopping_day)[true_s]
            obs_buy = 1 if (random.random() < p_emit_true) else 0

            days_elapsed = float(t - last_purchase_day)
            eff_pomdp_days = max(1.0, days_elapsed - pomdp_age_discount)

            T_pop = build_memoryless_transition(cat.mean_days_to_deplete)
            T_hier_mem = build_memoryless_transition(est_deplete_days)
            T_hsmm = build_hsmm_age_transition(days_elapsed, est_deplete_days, est_cv)
            T_pomdp = build_hsmm_age_transition(eff_pomdp_days, est_deplete_days, est_cv)

            b_pop_prior = mat_vec_mul(b_pop, T_pop)
            b_hier_hmm_prior = mat_vec_mul(b_hier_hmm, T_hier_mem)
            b_hsmm_prior = mat_vec_mul(b_hsmm, T_hsmm)
            b_pomdp_prior = mat_vec_mul(b_pomdp, T_pomdp)

            if is_shopping_day:
                c_idx = min(8, len(observed_deplete_estimates) + 1)
                needed_this_week = (random.random() < cat.recipe_use_freq_weekly)
                for m in methods:
                    stats[m]["total_checks"] += 1

                def record_eval(m_key: str, b_vec: List[float], action_buy: bool, queried: bool = False, needed: bool = True):
                    pred_s = argmax(b_vec)
                    stats[m_key]["correct_3state"] += int(pred_s == true_s)
                    stats[m_key]["correct_s0_binary"] += int((pred_s == 0) == (true_s == 0))
                    stats[m_key]["brier_sum"] += (b_vec[0] - float(true_s == 0))**2
                    if not needed:
                        return
                    if queried:
                        stats[m_key]["queries_asked"] += 1
                        stats[m_key]["total_loss_usd"] += cat.query_cost
                    else:
                        if action_buy:
                            if true_s != 0:
                                stats[m_key]["overbuy_events"] += 1
                                stats[m_key]["total_loss_usd"] += cat.overbuy_cost
                        else:
                            if true_s == 0:
                                stats[m_key]["stockout_events"] += 1
                                stats[m_key]["total_loss_usd"] += cat.stockout_cost

                # Method 1: Population Memoryless HMM (MAP)
                record_eval("1_pop_memoryless_hmm", b_pop_prior, argmax(b_pop_prior) == 0, needed=needed_this_week)

                # Method 2: Hierarchical Memoryless HMM (MAP)
                record_eval("2_hier_memoryless_hmm", b_hier_hmm_prior, argmax(b_hier_hmm_prior) == 0, needed=needed_this_week)

                # Method 3: Hierarchical Semi-Markov HSMM (MAP)
                record_eval("3_hier_hsmm_map", b_hsmm_prior, argmax(b_hsmm_prior) == 0, needed=needed_this_week)
                cycle_acc[c_idx].append(int(argmax(b_hsmm_prior) == true_s))

                # Method 4: Hierarchical HSMM + Asymmetric Bayesian Decision Rule
                thresh_buy = cat.overbuy_cost / (cat.stockout_cost + cat.overbuy_cost)
                record_eval("4_hier_hsmm_asymmetric_loss", b_hsmm_prior, b_hsmm_prior[0] >= thresh_buy, needed=needed_this_week)

                # Method 5: POMDP with Active EVSI Querying (Only queries when recipe needs item AND EVSI > query_cost)
                p_s0 = b_pomdp_prior[0]
                loss_exclude = p_s0 * cat.stockout_cost
                loss_autobuy = (1.0 - p_s0) * cat.overbuy_cost
                evsi = min(loss_exclude, loss_autobuy)
                if needed_this_week and (evsi > cat.query_cost):
                    stats["5_pomdp_active_evsi"]["queries_asked"] += 1
                    stats["5_pomdp_active_evsi"]["total_loss_usd"] += cat.query_cost
                    if true_s == 0:
                        b_pomdp_prior = [1.0, 0.0, 0.0]
                        obs_buy = 1
                    else:
                        # User confirms still in stock -> reset S0 prob to 0 and shift effective age back to<=75% of cycle
                        s12 = b_pomdp_prior[1] + b_pomdp_prior[2]
                        b_pomdp_prior = [0.0, b_pomdp_prior[1]/max(1e-6, s12), b_pomdp_prior[2]/max(1e-6, s12)]
                        target_age = min(eff_pomdp_days, 0.72 * est_deplete_days)
                        pomdp_age_discount = max(0.0, days_elapsed - target_age)
                    stats["5_pomdp_active_evsi"]["correct_3state"] += int(argmax(b_pomdp_prior) == true_s)
                    stats["5_pomdp_active_evsi"]["correct_s0_binary"] += 1
                    stats["5_pomdp_active_evsi"]["brier_sum"] += (b_pomdp_prior[0] - float(true_s == 0))**2
                else:
                    record_eval("5_pomdp_active_evsi", b_pomdp_prior, loss_autobuy < loss_exclude, queried=False, needed=needed_this_week)

                # Method 6: Entropy-Aware Recipe Selection (Game-Theoretic Risk Avoidance)
                # When item is in the high-entropy boundary (0.12 <= P(S0) <= 0.75) and replaceable (like pasta/squid),
                # the meal planner substitutes an alternate recipe that doesn't rely on this uncertain item!
                p_s0_h = b_hsmm_prior[0]
                in_uncertain_zone = (0.12 <= p_s0_h <= 0.75)
                if needed_this_week and in_uncertain_zone and cat.recipe_use_freq_weekly <= 0.60:
                    # Planner substitutes recipe to avoid uncertain pantry item without asking user!
                    record_eval("6_entropy_aware_recipe_avoidance", b_hsmm_prior, False, queried=False, needed=False)
                else:
                    record_eval("6_entropy_aware_recipe_avoidance", b_hsmm_prior, p_s0_h >= thresh_buy, queried=False, needed=needed_this_week)

            # 5. Bayesian Observation Update with O_t (Purchase vs. No-Purchase)
            e_prob = emission_probs(cat, is_shopping_day)
            if obs_buy == 1:
                interval = t - last_purchase_day
                if interval >= 3:
                    est_deplete_this_cycle = max(2.0, float(interval) - cum_s0_days_in_cycle)
                    capped = min(est_deplete_this_cycle, cat.mean_days_to_deplete * 2.5)
                    observed_deplete_estimates.append(capped)
                    n_obs = len(observed_deplete_estimates)
                    sample_mean = sum(observed_deplete_estimates) / n_obs
                    est_deplete_days = (prior_weight * cat.mean_days_to_deplete + n_obs * sample_mean) / (prior_weight + n_obs)
                    est_cv = max(0.12, cat.cv_household / math.sqrt(1.0 + 0.7 * n_obs))

                last_purchase_day = t
                pomdp_age_discount = 0.0
                cum_s0_days_in_cycle = 0.0
                q = 1.0
                b_pop = [0.0, 0.0, 1.0]
                b_hier_hmm = [0.0, 0.0, 1.0]
                b_hsmm = [0.0, 0.0, 1.0]
                b_pomdp = [0.0, 0.0, 1.0]
            else:
                like_no_buy = [1.0 - e_prob[s] for s in range(3)]
                b_pop = normalize([b_pop_prior[s] * like_no_buy[s] for s in range(3)])
                b_hier_hmm = normalize([b_hier_hmm_prior[s] * like_no_buy[s] for s in range(3)])
                b_hsmm = normalize([b_hsmm_prior[s] * like_no_buy[s] for s in range(3)])
                b_pomdp = normalize([b_pomdp_prior[s] * like_no_buy[s] for s in range(3)])
                cum_s0_days_in_cycle += b_hsmm[0]

    summary = {}
    for m, d in stats.items():
        n_c = d["total_checks"]
        summary[m] = {
            "3state_acc_pct": round(100.0 * d["correct_3state"] / n_c, 1),
            "s0_binary_acc_pct": round(100.0 * d["correct_s0_binary"] / n_c, 1),
            "brier_s0": round(d["brier_sum"] / n_c, 3),
            "stockout_rate_pct": round(100.0 * d["stockout_events"] / n_c, 2),
            "overbuy_rate_pct": round(100.0 * d["overbuy_events"] / n_c, 2),
            "query_rate_pct": round(100.0 * d["queries_asked"] / n_c, 2),
            "annual_loss_usd": round(d["total_loss_usd"] / n_households, 2),
        }
    learning_curve = {
        f"cycle_{k}": round(100.0 * sum(v) / len(v), 1) if v else None
        for k, v in cycle_acc.items()
    }
    return summary, learning_curve

results = {}
for cat in CATEGORIES:
    s, c = simulate_category(cat)
    results[cat.name] = {
        "ko_name": cat.ko_name,
        "mean_days": cat.mean_days_to_deplete,
        "prob_buy_when_depleted": cat.prob_buy_when_depleted,
        "summary": s,
        "learning_curve_3state_acc": c,
    }

print(json.dumps(results, indent=2, ensure_ascii=False))
