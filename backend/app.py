from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import json
import random
import traceback
from models.splcge import add_input_solve
from models.dynamic_splcge import dynamic_solve, extract_results
from sam_utils.generator import generate_random_sam as gen_sam
from utils.validators import (
    RequestValidationError,
    adjust_parameter_list,
    parse_json_request,
    validate_sam_structure,
    extract_parameters
)

app = Flask(__name__)
# Enable CORS for all routes and all origins
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/solve-model', methods=['POST'])
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

        print(f"Solving model with template: {template_id}")
        print(f"Parameters: {params}")
        print(f"SAM provided: {'Yes' if sam else 'No'}")

        # For MVP, we only support the simple CGE model
        if template_id == 'simple-cge':
            try:
                alpha_input, b_input = extract_parameters(params, [0.3, 0.7], [1.0, 1.0])
            except RequestValidationError as exc:
                return jsonify({'error': exc.message}), exc.status_code

            print(f"Alpha parameters: {alpha_input}")
            print(f"B parameters: {b_input}")

            # If a custom SAM is provided, use the dynamic model
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
                    print(
                        f"Warning: Alpha parameters count ({len(alpha_input)}) doesn't match sector count ({len(sectors)}). Adjusting..."
                    )
                    alpha_input = adjust_parameter_list(alpha_input, len(sectors), 1.0 / len(sectors))
                    total = sum(alpha_input)
                    if total:
                        alpha_input = [a / total for a in alpha_input]
                    print(f"Adjusted alpha parameters: {alpha_input}")

                if len(b_input) != len(sectors):
                    print(
                        f"Warning: B parameters count ({len(b_input)}) doesn't match sector count ({len(sectors)}). Adjusting..."
                    )
                    b_input = adjust_parameter_list(b_input, len(sectors), 1.0)
                    print(f"Adjusted b parameters: {b_input}")

                print(f"Using dynamic model with {len(sectors)} sectors, {len(factors)} factors, {len(households)} households")
                print(f"SAM data has {len(sam_data)} rows")

                try:
                    # Solve the dynamic model
                    container = dynamic_solve(sectors, factors, households, sam_data, alpha_input, b_input)
                    results = extract_results(container)
                    print("Model solved successfully")
                    return jsonify(results)
                except Exception as model_error:
                    error_message = f"Error solving dynamic model: {str(model_error)}"
                    stack_trace = traceback.format_exc()
                    print(error_message)
                    print(stack_trace)
                    return jsonify({
                        'error': error_message,
                        'trace': stack_trace,
                        'details': 'There was a problem solving the model with the provided SAM.'
                    }), 500

            # Otherwise, use the default model
            print("Using default model with predefined SAM")
            try:
                container = add_input_solve(b_input, alpha_input)

                # Extract and validate results
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

                # Extract results
                # px = px_records.tolist()
                # Z = z_records.tolist()
                UU = container["UU"].toValue()

                # Format results
                prices = container["px"].toDict()
                production = container["Z"].toDict()

                # for item in px:
                #     if len(item) >= 2:  # Ensure the item has enough elements
                #         prices[str(item[0])] = float(item[1])

                # for item in Z:
                #     if len(item) >= 2:  # Ensure the item has enough elements
                #         production[str(item[0])] = float(item[1])

                # Simple GDP calculation with error checking
                try:
                    gdp = sum(production.values())
                except Exception as gdp_error:
                    print(f"Error calculating GDP: {str(gdp_error)}")
                    gdp = 0

                print("Default model solved successfully")
                return jsonify({
                    'prices': prices,
                    'production': production,
                    'utility': float(UU) if UU is not None else 0,
                    'gdp': float(gdp) if gdp is not None else 0
                })
            except Exception as default_model_error:
                error_message = f"Error solving default model: {str(default_model_error)}"
                stack_trace = traceback.format_exc()
                print(error_message)
                print(stack_trace)
                return jsonify({
                    'error': error_message,
                    'trace': stack_trace,
                    'details': 'There was a problem solving the default model.'
                }), 500
        else:
            # For other templates (not implemented in MVP)
            return jsonify({
                'error': 'This template is not yet implemented in the MVP'
            }), 400
    except Exception as e:
        error_message = f"Error solving model: {str(e)}"
        stack_trace = traceback.format_exc()
        print(error_message)
        print(stack_trace)
        return jsonify({
            'error': error_message,
            'trace': stack_trace,
            'details': 'There was an unexpected error processing your request.'
        }), 500

@app.route('/compare-scenarios', methods=['POST'])
def compare_scenarios():
    try:
        try:
            data = parse_json_request(request)
        except RequestValidationError as exc:
            return jsonify({'error': exc.message}), exc.status_code

        template_id = 'simple-cge'  # For MVP, only simple CGE is supported
        baseline_params = data.get('baselineParams', {})
        scenario_params = data.get('scenarioParams', {})

        if not isinstance(baseline_params, dict):
            return jsonify({'error': 'Baseline parameters must be an object'}), 400

        if not isinstance(scenario_params, dict):
            return jsonify({'error': 'Scenario parameters must be an object'}), 400

        sam = data.get('sam')

        print(f"Comparing scenarios with template: {template_id}")
        print(f"Baseline params: {baseline_params}")
        print(f"Scenario params: {scenario_params}")
        print(f"SAM provided: {'Yes' if sam else 'No'}")

        if sam:
            try:
                sam_info = validate_sam_structure(sam)
            except RequestValidationError as exc:
                return jsonify({'error': exc.message}), exc.status_code

            sectors = sam_info['sectors']
            factors = sam_info['factors']
            households = sam_info['households']
            sam_data = sam_info['data']

            # Default parameters based on sector count
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

            # Normalize alpha parameters to sum to 1.0
            def normalize_alpha(alpha):
                total = sum(alpha)
                if total > 0:
                    return [a/total for a in alpha]
                return [1.0/len(alpha)] * len(alpha)

            baseline_alpha = normalize_alpha(baseline_alpha)
            scenario_alpha = normalize_alpha(scenario_alpha)

            try:
                print(f"Solving baseline model with custom SAM")
                baseline_container = dynamic_solve(sectors, factors, households, sam_data, baseline_alpha, baseline_b)
                baseline_results = extract_results(baseline_container)

                print(f"Solving scenario model with custom SAM")
                scenario_container = dynamic_solve(sectors, factors, households, sam_data, scenario_alpha, scenario_b)
                scenario_results = extract_results(scenario_container)

                # Calculate differences
                baseline_prices = baseline_results['prices']
                baseline_production = baseline_results['production']
                baseline_utility = baseline_results['utility']
                baseline_gdp = baseline_results['gdp']

                scenario_prices = scenario_results['prices']
                scenario_production = scenario_results['production']
                scenario_utility = scenario_results['utility']
                scenario_gdp = scenario_results['gdp']

                # Calculate differences with error checking
                price_diffs = {}
                for key in baseline_prices:
                    try:
                        baseline_value = float(baseline_prices[key])
                        scenario_value = float(scenario_prices.get(key, 0))
                        diff = scenario_value - baseline_value
                        percent_change = (diff / baseline_value) * 100 if baseline_value != 0 else 0
                        price_diffs[key] = {
                            'value': float(diff),
                            'percentChange': float(percent_change)
                        }
                    except (ValueError, TypeError) as e:
                        print(f"Error calculating price difference for {key}: {e}")
                        price_diffs[key] = {
                            'value': 0,
                            'percentChange': 0
                        }

                production_diffs = {}
                for key in baseline_production:
                    try:
                        baseline_value = float(baseline_production[key])
                        scenario_value = float(scenario_production.get(key, 0))
                        diff = scenario_value - baseline_value
                        percent_change = (diff / baseline_value) * 100 if baseline_value != 0 else 0
                        production_diffs[key] = {
                            'value': float(diff),
                            'percentChange': float(percent_change)
                        }
                    except (ValueError, TypeError) as e:
                        print(f"Error calculating production difference for {key}: {e}")
                        production_diffs[key] = {
                            'value': 0,
                            'percentChange': 0
                        }

                # Calculate utility and GDP differences
                try:
                    utility_diff = float(scenario_utility) - float(baseline_utility)
                    utility_percent = (utility_diff / float(baseline_utility)) * 100 if float(baseline_utility) != 0 else 0
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    print(f"Error calculating utility difference: {e}")
                    utility_diff = 0
                    utility_percent = 0

                try:
                    gdp_diff = float(scenario_gdp) - float(baseline_gdp)
                    gdp_percent = (gdp_diff / float(baseline_gdp)) * 100 if float(baseline_gdp) != 0 else 0
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    print(f"Error calculating GDP difference: {e}")
                    gdp_diff = 0
                    gdp_percent = 0

                print("Scenario comparison with custom SAM completed successfully")
                return jsonify({
                    'baseline': baseline_results,
                    'scenario': scenario_results,
                    'differences': {
                        'prices': price_diffs,
                        'production': production_diffs,
                        'utility': {
                            'value': float(utility_diff),
                            'percentChange': float(utility_percent)
                        },
                        'gdp': {
                            'value': float(gdp_diff),
                            'percentChange': float(gdp_percent)
                        }
                    }
                })
            except Exception as model_error:
                error_message = f"Error during dynamic model comparison: {str(model_error)}"
                stack_trace = traceback.format_exc()
                print(error_message)
                print(stack_trace)
                return jsonify({
                    'error': error_message,
                    'trace': stack_trace,
                    'details': 'There was a problem comparing scenarios with the custom SAM.'
                }), 500

        # If no custom SAM provided, use default model
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

            print(f"Solving baseline model with default SAM")
            baseline_container = add_input_solve(baseline_b, baseline_alpha)

            print(f"Solving scenario model with default SAM")
            scenario_container = add_input_solve(scenario_b, scenario_alpha)

            # Function to safely extract records
            def extract_container_results(container):
                # try:
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

                # Extract and format results
                px = container["px"].toDict()
                Z = container["Z"].toDict()
                UU = container["UU"].toValue()

                prices = container["px"].toDict()
                production = container["Z"].toDict()

                # for item in px:
                #     if len(item) >= 2:
                #         prices[str(item[0])] = float(item[1])

                # for item in Z:
                #     if len(item) >= 2:
                #         production[str(item[0])] = float(item[1])

                # Safe GDP calculation
                try:
                    gdp = sum(production.values())
                except:
                    gdp = 0

                return {
                    'prices': prices,
                    'production': production,
                    'utility': float(UU) if UU is not None else 0,
                    'gdp': float(gdp) if gdp is not None else 0
                }
                # except Exception as e:
                #     print(f"Error extracting container results: {e}")
                #     # Return empty results structure
                #     return {
                #         'prices': {},
                #         'production': {},
                #         'utility': 0,
                #         'gdp': 0
                #     }

            # Extract results
            baseline_results = extract_container_results(baseline_container)
            scenario_results = extract_container_results(scenario_container)

            # Calculate differences with error handling
            price_diffs = {}
            for key in baseline_results['prices']:
                try:
                    baseline_value = float(baseline_results['prices'][key])
                    scenario_value = float(scenario_results['prices'].get(key, 0))
                    diff = scenario_value - baseline_value
                    percent_change = (diff / baseline_value) * 100 if baseline_value != 0 else 0
                    price_diffs[key] = {
                        'value': float(diff),
                        'percentChange': float(percent_change)
                    }
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    print(f"Error calculating price diff for {key}: {e}")
                    price_diffs[key] = {'value': 0, 'percentChange': 0}

            production_diffs = {}
            for key in baseline_results['production']:
                try:
                    baseline_value = float(baseline_results['production'][key])
                    scenario_value = float(scenario_results['production'].get(key, 0))
                    diff = scenario_value - baseline_value
                    percent_change = (diff / baseline_value) * 100 if baseline_value != 0 else 0
                    production_diffs[key] = {
                        'value': float(diff),
                        'percentChange': float(percent_change)
                    }
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    print(f"Error calculating production diff for {key}: {e}")
                    production_diffs[key] = {'value': 0, 'percentChange': 0}

            # Calculate other differences
            try:
                utility_diff = float(scenario_results['utility']) - float(baseline_results['utility'])
                utility_percent = (utility_diff / float(baseline_results['utility'])) * 100 if float(baseline_results['utility']) != 0 else 0
            except (ValueError, TypeError, ZeroDivisionError) as e:
                utility_diff = 0
                utility_percent = 0

            try:
                gdp_diff = float(scenario_results['gdp']) - float(baseline_results['gdp'])
                gdp_percent = (gdp_diff / float(baseline_results['gdp'])) * 100 if float(baseline_results['gdp']) != 0 else 0
            except (ValueError, TypeError, ZeroDivisionError) as e:
                gdp_diff = 0
                gdp_percent = 0

            print("Scenario comparison with default SAM completed successfully")
            return jsonify({
                'baseline': baseline_results,
                'scenario': scenario_results,
                'differences': {
                    'prices': price_diffs,
                    'production': production_diffs,
                    'utility': {
                        'value': float(utility_diff),
                        'percentChange': float(utility_percent)
                    },
                    'gdp': {
                        'value': float(gdp_diff),
                        'percentChange': float(gdp_percent)
                    }
                }
            })
        except Exception as default_error:
            error_message = f"Error in default model comparison: {str(default_error)}"
            stack_trace = traceback.format_exc()
            print(error_message)
            print(stack_trace)
            return jsonify({
                'error': error_message,
                'trace': stack_trace,
                'details': 'There was a problem comparing scenarios with the default model.'
            }), 500
    except Exception as e:
        error_message = f"Error comparing scenarios: {str(e)}"
        stack_trace = traceback.format_exc()
        print(error_message)
        print(stack_trace)
        return jsonify({
            'error': error_message,
            'trace': stack_trace,
            'details': 'There was an unexpected error processing your request.'
        }), 500

@app.route('/generate-random-sam', methods=['POST'])
def generate_random_sam():
    print("Received generate-random-sam request")
    try:
        # Validate request data
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400

        data = request.json
        if not data:
            return jsonify({'error': 'Empty request body'}), 400

        dimensions = data.get('dimensions', {})
        if not isinstance(dimensions, dict):
            return jsonify({'error': 'Dimensions must be an object'}), 400

        # Extract and validate dimensions
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

        # Get and validate custom names if provided
        sector_names = dimensions.get('sectorNames', None)
        factor_names = dimensions.get('factorNames', None)
        household_names = dimensions.get('householdNames', None)

        # Validate name arrays if provided
        if sector_names is not None and not isinstance(sector_names, list):
            return jsonify({'error': 'sectorNames must be an array'}), 400
        if factor_names is not None and not isinstance(factor_names, list):
            return jsonify({'error': 'factorNames must be an array'}), 400
        if household_names is not None and not isinstance(household_names, list):
            return jsonify({'error': 'householdNames must be an array'}), 400

        print(f"Generating SAM with dimensions: sectors={sectors}, factors={factors}, households={households}")
        print(f"Custom names: sectors={sector_names}, factors={factor_names}, households={household_names}")

        # Generate a balanced SAM
        try:
            # The SAM generation and name handling is now done inside gen_sam
            sam_result = gen_sam(
                sectors,
                factors,
                households,
                sector_names=sector_names,
                factor_names=factor_names,
                household_names=household_names
            )

            # Verify result structure
            required_keys = ['entries', 'goods', 'factors', 'households', 'data']
            missing_keys = [key for key in required_keys if key not in sam_result or not sam_result[key]]

            if missing_keys:
                error_msg = f"Generated SAM is missing required properties: {', '.join(missing_keys)}"
                print(error_msg)
                return jsonify({'error': error_msg}), 500

            # Verify data dimensions
            if len(sam_result['data']) != len(sam_result['entries']):
                error_msg = f"SAM data dimensions mismatch: data rows={len(sam_result['data'])}, entries={len(sam_result['entries'])}"
                print(error_msg)
                return jsonify({'error': error_msg}), 500

            for row in sam_result['data']:
                if len(row) != len(sam_result['entries']):
                    error_msg = f"SAM data dimensions mismatch: row length={len(row)}, entries={len(sam_result['entries'])}"
                    print(error_msg)
                    return jsonify({'error': error_msg}), 500

            print(f"SAM generated successfully with dimensions {len(sam_result['entries'])}x{len(sam_result['entries'])}")
            print(f"Sectors: {sam_result['goods']}")
            print(f"Factors: {sam_result['factors']}")
            print(f"Households: {sam_result['households']}")

            # Return successful result
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
            print(error_message)
            print(stack_trace)
            return jsonify({
                'error': error_message,
                'trace': stack_trace,
                'details': 'There was a problem generating the SAM. Please check the dimensions and try again.'
            }), 500

    except Exception as e:
        error_message = f"Error in generate_random_sam handler: {str(e)}"
        stack_trace = traceback.format_exc()
        print(error_message)
        print(stack_trace)
        return jsonify({
            'error': error_message,
            'trace': stack_trace,
            'details': 'There was an unexpected error processing your request.'
        }), 500

# Add a simple test route
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'ok',
        'message': 'CGE Model API is running'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5002, host='0.0.0.0')