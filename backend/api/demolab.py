from flask import Blueprint, request, jsonify
import traceback

from utils.validators import (
    RequestValidationError,
    adjust_parameter_list,
    parse_json_request,
    validate_sam_structure,
    extract_parameters,
)
from models.demolab.splcge import add_input_solve
from models.demolab.dynamic_splcge import dynamic_solve, extract_results
from models.demolab.model_wrappers import solve_cameroon, solve_korea, solve_saudi
from sam_utils.generator import generate_random_sam as gen_sam


demolab_bp = Blueprint('demolab', __name__)


@demolab_bp.route('/solve-model', methods=['POST'])
def solve_model():
    try:
        try:
            data = parse_json_request(request)
        except RequestValidationError as exc:
            return jsonify({'error': exc.message}), exc.status_code

        template_id = data.get('templateId', 'simple-cge')
        if not template_id:
            return jsonify({'error': 'Missing template ID'}), 400

        params = data.get('params', {})
        if not isinstance(params, dict):
            return jsonify({'error': 'Parameters must be an object'}), 400

        sam = data.get('sam')

        if template_id == 'simple-cge':
            try:
                alpha_input, b_input = extract_parameters(params, [0.3, 0.7], [1.0, 1.0])
            except RequestValidationError as exc:
                return jsonify({'error': exc.message}), exc.status_code

            if sam:
                try:
                    sam_info = validate_sam_structure(sam)
                except RequestValidationError as exc:
                    return jsonify({'error': exc.message}), exc.status_code
                sectors = sam_info['sectors']
                factors = sam_info['factors']
                households = sam_info['households']
                sam_data = sam_info['data']

                if len(alpha_input) != len(sectors):
                    alpha_input = adjust_parameter_list(alpha_input, len(sectors), 1.0 / len(sectors))
                    total = sum(alpha_input)
                    if total:
                        alpha_input = [a / total for a in alpha_input]

                if len(b_input) != len(sectors):
                    b_input = adjust_parameter_list(b_input, len(sectors), 1.0)

                try:
                    container = dynamic_solve(sectors, factors, households, sam_data, alpha_input, b_input)
                    results = extract_results(container)
                    return jsonify(results)
                except Exception as model_error:
                    error_message = f"Error solving dynamic model: {str(model_error)}"
                    stack_trace = traceback.format_exc()
                    return jsonify({'error': error_message, 'trace': stack_trace}), 500

            try:
                container = add_input_solve(b_input, alpha_input)
                if container is None:
                    return jsonify({'error': 'Model failed to solve'}), 500
                if "px" not in container or "Z" not in container or "UU" not in container:
                    return jsonify({'error': 'Model solution is incomplete'}), 500

                px_records = container["px"].records
                if px_records is None or len(px_records) == 0:
                    return jsonify({'error': 'Model produced empty price results'}), 500
                z_records = container["Z"].records
                if z_records is None or len(z_records) == 0:
                    return jsonify({'error': 'Model produced empty production results'}), 500
                uu_records = container["UU"].records
                if uu_records is None or len(uu_records) == 0:
                    return jsonify({'error': 'Model produced empty utility results'}), 500

                UU = container["UU"].toValue()
                prices = container["px"].toDict()
                production = container["Z"].toDict()
                try:
                    gdp = sum(production.values())
                except Exception:
                    gdp = 0

                return jsonify({
                    'prices': prices,
                    'production': production,
                    'utility': float(UU) if UU is not None else 0,
                    'gdp': float(gdp) if gdp is not None else 0
                })
            except Exception as default_model_error:
                error_message = f"Error solving default model: {str(default_model_error)}"
                stack_trace = traceback.format_exc()
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        elif template_id == 'cameroon-cge':
            try:
                results = solve_cameroon()
                return jsonify(results)
            except Exception as cam_error:
                error_message = f"Error solving Cameroon model: {cam_error}"
                stack_trace = traceback.format_exc()
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        elif template_id == 'korea-cge':
            try:
                results = solve_korea()
                return jsonify(results)
            except Exception as kor_error:
                error_message = f"Error solving Korea model: {kor_error}"
                stack_trace = traceback.format_exc()
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        elif template_id == 'saudi-cge':
            try:
                results = solve_saudi()
                return jsonify(results)
            except Exception as sau_error:
                error_message = f"Error solving Saudi model: {sau_error}"
                stack_trace = traceback.format_exc()
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        elif template_id in ('mn1', 'mn1-cge'):
            try:
                from models.workspace.mn1_wrapper import solve_mn1
                results = solve_mn1(params, sam)
                return jsonify(results)
            except Exception as mn1_error:
                error_message = f"Error solving MN1 model: {mn1_error}"
                stack_trace = traceback.format_exc()
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        else:
            return jsonify({'error': 'This template is not yet implemented in the MVP'}), 400
    except Exception as e:
        error_message = f"Error solving model: {str(e)}"
        stack_trace = traceback.format_exc()
        return jsonify({'error': error_message, 'trace': stack_trace}), 500


@demolab_bp.route('/compare-scenarios', methods=['POST'])
def compare_scenarios():
    try:
        try:
            data = parse_json_request(request)
        except RequestValidationError as exc:
            return jsonify({'error': exc.message}), exc.status_code

        template_id = data.get('templateId', 'simple-cge')
        baseline_params = data.get('baselineParams', {})
        scenario_params = data.get('scenarioParams', {})
        if not isinstance(baseline_params, dict) or not isinstance(scenario_params, dict):
            return jsonify({'error': 'Parameters must be objects'}), 400

        sam = data.get('sam')

        if template_id == 'korea-cge':
            try:
                baseline_results = solve_korea(
                    baseline_params.get('tariff'),
                    baseline_params.get('indirectTax'),
                    baseline_params.get('incomeTax'),
                )
                scenario_results = solve_korea(
                    scenario_params.get('tariff'),
                    scenario_params.get('indirectTax'),
                    scenario_params.get('incomeTax'),
                )
                def diff_val(b: float, o: float):
                    val = o - b
                    pct = (val / b * 100) if b != 0 else 0
                    return {'value': val, 'percentChange': pct}
                diffs = {
                    'omega': diff_val(baseline_results['omega'], scenario_results['omega']),
                    'y': diff_val(baseline_results['y'], scenario_results['y']),
                    'gr': diff_val(baseline_results.get('gr', 0), scenario_results.get('gr', 0)),
                    'yh': {hh: diff_val(baseline_results['yh'].get(hh, 0), scenario_results['yh'].get(hh, 0)) for hh in baseline_results['yh']}
                }
                return jsonify({'baseline': baseline_results, 'scenario': scenario_results, 'differences': diffs})
            except Exception as kor_err:
                error_message = f"Error comparing Korea scenarios: {kor_err}"
                stack_trace = traceback.format_exc()
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        elif template_id == 'saudi-cge':
            try:
                baseline_results = solve_saudi(
                    baseline_params.get('tariff'),
                    baseline_params.get('indirectTax'),
                    baseline_params.get('incomeTax'),
                )
                scenario_results = solve_saudi(
                    scenario_params.get('tariff'),
                    scenario_params.get('indirectTax'),
                    scenario_params.get('incomeTax'),
                )
                def diff_val(b: float, o: float):
                    val = o - b
                    pct = (val / b * 100) if b != 0 else 0
                    return {'value': val, 'percentChange': pct}
                diffs = {
                    'omega': diff_val(baseline_results['omega'], scenario_results['omega']),
                    'y': diff_val(baseline_results['y'], scenario_results['y']),
                    'gr': diff_val(baseline_results.get('gr', 0), scenario_results.get('gr', 0)),
                    'yh': {hh: diff_val(baseline_results['yh'].get(hh, 0), scenario_results['yh'].get(hh, 0)) for hh in baseline_results['yh']}
                }
                return jsonify({'baseline': baseline_results, 'scenario': scenario_results, 'differences': diffs})
            except Exception as sau_err:
                error_message = f"Error comparing Saudi scenarios: {sau_err}"
                stack_trace = traceback.format_exc()
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        if sam:
            try:
                sam_info = validate_sam_structure(sam)
            except RequestValidationError as exc:
                return jsonify({'error': exc.message}), exc.status_code
            sectors = sam_info['sectors']
            factors = sam_info['factors']
            households = sam_info['households']
            sam_data = sam_info['data']

            default_alpha = [1.0 / len(sectors)] * len(sectors)
            default_b = [1.0] * len(sectors)
            try:
                baseline_alpha, baseline_b = extract_parameters(baseline_params, default_alpha, default_b)
                scenario_alpha, scenario_b = extract_parameters(scenario_params, default_alpha, default_b)
            except RequestValidationError as exc:
                return jsonify({'error': exc.message}), exc.status_code

            baseline_alpha = adjust_parameter_list(baseline_alpha, len(sectors), 1.0 / len(sectors))
            baseline_b = adjust_parameter_list(baseline_b, len(sectors), 1.0)
            scenario_alpha = adjust_parameter_list(scenario_alpha, len(sectors), 1.0 / len(sectors))
            scenario_b = adjust_parameter_list(scenario_b, len(sectors), 1.0)

            def normalize_alpha(alpha):
                total = sum(alpha)
                if total > 0:
                    return [a/total for a in alpha]
                return [1.0/len(alpha)] * len(alpha)

            baseline_alpha = normalize_alpha(baseline_alpha)
            scenario_alpha = normalize_alpha(scenario_alpha)

            try:
                baseline_container = dynamic_solve(sectors, factors, households, sam_data, baseline_alpha, baseline_b)
                baseline_results = extract_results(baseline_container)
                scenario_container = dynamic_solve(sectors, factors, households, sam_data, scenario_alpha, scenario_b)
                scenario_results = extract_results(scenario_container)

                def diff_map(base: dict, other: dict):
                    out = {}
                    for key in base:
                        try:
                            bv = float(base.get(key, 0))
                            ov = float(other.get(key, 0))
                            dv = ov - bv
                            dp = (dv / bv * 100) if bv != 0 else 0
                            out[key] = {'value': float(dv), 'percentChange': float(dp)}
                        except Exception:
                            out[key] = {'value': 0, 'percentChange': 0}
                    return out

                return jsonify({
                    'baseline': baseline_results,
                    'scenario': scenario_results,
                    'differences': {
                        'prices': diff_map(baseline_results['prices'], scenario_results['prices']),
                        'production': diff_map(baseline_results['production'], scenario_results['production']),
                        'utility': {
                            'value': float(scenario_results['utility']) - float(baseline_results['utility']),
                            'percentChange': (float(scenario_results['utility']) - float(baseline_results['utility'])) / float(baseline_results['utility']) * 100 if float(baseline_results['utility']) != 0 else 0
                        },
                        'gdp': {
                            'value': float(scenario_results['gdp']) - float(baseline_results['gdp']),
                            'percentChange': (float(scenario_results['gdp']) - float(baseline_results['gdp'])) / float(baseline_results['gdp']) * 100 if float(baseline_results['gdp']) != 0 else 0
                        }
                    }
                })
            except Exception as model_error:
                error_message = f"Error during dynamic model comparison: {str(model_error)}"
                stack_trace = traceback.format_exc()
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        try:
            default_alpha = [0.3, 0.7]
            default_b = [1.0, 1.0]
            try:
                baseline_alpha, baseline_b = extract_parameters(baseline_params, default_alpha, default_b)
                scenario_alpha, scenario_b = extract_parameters(scenario_params, default_alpha, default_b)
            except RequestValidationError as exc:
                return jsonify({'error': exc.message}), exc.status_code

            baseline_alpha = adjust_parameter_list(baseline_alpha, 2, 0.5)
            baseline_b = adjust_parameter_list(baseline_b, 2, 1.0)
            scenario_alpha = adjust_parameter_list(scenario_alpha, 2, 0.5)
            scenario_b = adjust_parameter_list(scenario_b, 2, 1.0)

            baseline_container = add_input_solve(baseline_b, baseline_alpha)
            scenario_container = add_input_solve(scenario_b, scenario_alpha)

            def extract_container_results(container):
                if container is None:
                    raise ValueError("Container is null")
                if "px" not in container or "Z" not in container or "UU" not in container:
                    raise ValueError("Container missing required variables")
                px_records = container["px"].records
                z_records = container["Z"].records
                uu_records = container["UU"].records
                if px_records is None or len(px_records) == 0:
                    raise ValueError("Price records are empty")
                if z_records is None or len(z_records) == 0:
                    raise ValueError("Production records are empty")
                if uu_records is None or len(uu_records) == 0:
                    raise ValueError("Utility records are empty")
                prices = container["px"].toDict()
                production = container["Z"].toDict()
                try:
                    gdp = sum(production.values())
                except Exception:
                    gdp = 0
                return {
                    'prices': prices,
                    'production': production,
                    'utility': float(container["UU"].toValue()) if container["UU"].toValue() is not None else 0,
                    'gdp': float(gdp) if gdp is not None else 0
                }

            baseline_results = extract_container_results(baseline_container)
            scenario_results = extract_container_results(scenario_container)

            def diff_map_safe(base: dict, other: dict):
                out = {}
                for key in base:
                    try:
                        bv = float(base.get(key, 0))
                        ov = float(other.get(key, 0))
                        dv = ov - bv
                        dp = (dv / bv * 100) if bv != 0 else 0
                        out[key] = {'value': float(dv), 'percentChange': float(dp)}
                    except Exception:
                        out[key] = {'value': 0, 'percentChange': 0}
                return out

            return jsonify({
                'baseline': baseline_results,
                'scenario': scenario_results,
                'differences': {
                    'prices': diff_map_safe(baseline_results['prices'], scenario_results['prices']),
                    'production': diff_map_safe(baseline_results['production'], scenario_results['production']),
                    'utility': {
                        'value': float(scenario_results['utility']) - float(baseline_results['utility']),
                        'percentChange': (float(scenario_results['utility']) - float(baseline_results['utility'])) / float(baseline_results['utility']) * 100 if float(baseline_results['utility']) != 0 else 0
                    },
                    'gdp': {
                        'value': float(scenario_results['gdp']) - float(baseline_results['gdp']),
                        'percentChange': (float(scenario_results['gdp']) - float(baseline_results['gdp'])) / float(baseline_results['gdp']) * 100 if float(baseline_results['gdp']) != 0 else 0
                    }
                }
            })
        except Exception as default_error:
            error_message = f"Error in default model comparison: {str(default_error)}"
            stack_trace = traceback.format_exc()
            return jsonify({'error': error_message, 'trace': stack_trace}), 500
    except Exception as e:
        error_message = f"Error comparing scenarios: {str(e)}"
        stack_trace = traceback.format_exc()
        return jsonify({'error': error_message, 'trace': stack_trace}), 500


@demolab_bp.route('/generate-random-sam', methods=['POST'])
def generate_random_sam():
    try:
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        data = request.json
        if not data:
            return jsonify({'error': 'Empty request body'}), 400

        dimensions = data.get('dimensions', {})
        if not isinstance(dimensions, dict):
            return jsonify({'error': 'Dimensions must be an object'}), 400

        try:
            sectors = int(dimensions.get('sectors', 2))
            factors = int(dimensions.get('factors', 2))
            households = int(dimensions.get('households', 1))
            if sectors <= 0 or factors <= 0 or households <= 0:
                return jsonify({'error': 'Number of sectors, factors, and households must be positive integers'}), 400
            if sectors > 20 or factors > 20 or households > 20:
                return jsonify({'error': 'For performance reasons, dimensions cannot exceed 20 for the MVP version'}), 400
        except (ValueError, TypeError) as e:
            return jsonify({'error': f'Invalid dimensions: {str(e)}'}), 400

        sector_names = dimensions.get('sectorNames', None)
        factor_names = dimensions.get('factorNames', None)
        household_names = dimensions.get('householdNames', None)
        if sector_names is not None and not isinstance(sector_names, list):
            return jsonify({'error': 'sectorNames must be an array'}), 400
        if factor_names is not None and not isinstance(factor_names, list):
            return jsonify({'error': 'factorNames must be an array'}), 400
        if household_names is not None and not isinstance(household_names, list):
            return jsonify({'error': 'householdNames must be an array'}), 400

        try:
            sam_result = gen_sam(
                sectors,
                factors,
                households,
                sector_names=sector_names,
                factor_names=factor_names,
                household_names=household_names
            )
            required_keys = ['entries', 'goods', 'factors', 'households', 'data']
            missing_keys = [key for key in required_keys if key not in sam_result or not sam_result[key]]
            if missing_keys:
                error_msg = f"Generated SAM is missing required properties: {', '.join(missing_keys)}"
                return jsonify({'error': error_msg}), 500
            if len(sam_result['data']) != len(sam_result['entries']):
                error_msg = f"SAM data dimensions mismatch: data rows={len(sam_result['data'])}, entries={len(sam_result['entries'])}"
                return jsonify({'error': error_msg}), 500
            for row in sam_result['data']:
                if len(row) != len(sam_result['entries']):
                    error_msg = f"SAM data dimensions mismatch: row length={len(row)}, entries={len(sam_result['entries'])}"
                    return jsonify({'error': error_msg}), 500
            return jsonify({
                'entries': sam_result['entries'],
                'goods': sam_result['goods'],
                'factors': sam_result['factors'],
                'households': sam_result['households'],
                'data': sam_result['data']
            })
        except Exception as sam_error:
            error_message = f"Error in SAM generation: {str(sam_error)}"
            stack_trace = traceback.format_exc()
            return jsonify({'error': error_message, 'trace': stack_trace}), 500
    except Exception as e:
        error_message = f"Error in generate_random_sam handler: {str(e)}"
        stack_trace = traceback.format_exc()
        return jsonify({'error': error_message, 'trace': stack_trace}), 500


