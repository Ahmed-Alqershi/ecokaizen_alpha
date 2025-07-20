from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import json
import random
import traceback
import sqlite3
import os
import smtplib
from email.message import EmailMessage
from werkzeug.security import generate_password_hash, check_password_hash
from models.splcge import add_input_solve
from models.dynamic_splcge import dynamic_solve, extract_results
from typing import Dict, Optional
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


def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                avatar TEXT
            )
            """
        )
        # Ensure avatar column exists for older installations
        try:
            conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
        except sqlite3.OperationalError:
            pass

        # Assign avatars to users who don't have one yet
        cur = conn.execute(
            "SELECT id, username FROM users WHERE avatar IS NULL OR avatar = ''"
        )
        for row in cur.fetchall():
            color = "#%06x" % random.randint(0, 0xFFFFFF)
            avatar = f"{row['username'][0].upper()}|{color}"
            conn.execute("UPDATE users SET avatar=? WHERE id=?", (avatar, row['id']))

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                template_id TEXT NOT NULL,
                params TEXT,
                sam TEXT,
                results TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )

        conn.commit()


init_db()


def get_user_id(username: str) -> int | None:
    with get_db_connection() as conn:
        cur = conn.execute('SELECT id FROM users WHERE username=?', (username,))
        row = cur.fetchone()
        return row['id'] if row else None


def insert_run(user_id: int, template_id: str, params: Dict, sam: Optional[Dict], results: Dict) -> int:
    with get_db_connection() as conn:
        cur = conn.execute(
            'INSERT INTO runs (user_id, template_id, params, sam, results) VALUES (?, ?, ?, ?, ?)',
            (user_id, template_id, json.dumps(params), json.dumps(sam) if sam else None, json.dumps(results)),
        )
        conn.commit()
        return cur.lastrowid


def fetch_runs_for_user(user_id: int) -> list[Dict]:
    with get_db_connection() as conn:
        cur = conn.execute(
            'SELECT id, template_id, params, sam, results, created_at FROM runs WHERE user_id=? ORDER BY created_at DESC',
            (user_id,),
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]


def fetch_run(run_id: int) -> Optional[Dict]:
    with get_db_connection() as conn:
        cur = conn.execute(
            'SELECT id, user_id, template_id, params, sam, results, created_at FROM runs WHERE id=?',
            (run_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def delete_run(run_id: int) -> None:
    with get_db_connection() as conn:
        conn.execute('DELETE FROM runs WHERE id=?', (run_id,))
        conn.commit()


def delete_runs_for_user(user_id: int) -> None:
    with get_db_connection() as conn:
        conn.execute('DELETE FROM runs WHERE user_id=?', (user_id,))
        conn.commit()


def send_contact_email(name: str, email: str, message: str):
    smtp_server = os.environ.get('SMTP_SERVER', 'localhost')
    smtp_port = int(os.environ.get('SMTP_PORT', 25))
    smtp_user = os.environ.get('SMTP_USERNAME')
    smtp_password = os.environ.get('SMTP_PASSWORD')

    msg = EmailMessage()
    msg['Subject'] = 'New Contact Form Submission'
    msg['From'] = email if not smtp_user else smtp_user
    msg['To'] = 'contact@kaizen.sa'
    msg.set_content(f"Name: {name}\nEmail: {email}\n\n{message}")

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            if smtp_user and smtp_password:
                server.starttls()
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True, 'Message sent'
    except Exception as e:
        print(f'Error sending email: {e}')
        return False, str(e)

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
        elif template_id == 'cameroon-cge':
            try:
                from models.model_wrappers import solve_cameroon
                results = solve_cameroon()
                return jsonify(results)
            except Exception as cam_error:
                error_message = f"Error solving Cameroon model: {cam_error}"
                stack_trace = traceback.format_exc()
                print(error_message)
                print(stack_trace)
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        elif template_id == 'korea-cge':
            try:
                from models.model_wrappers import solve_korea
                results = solve_korea()
                return jsonify(results)
            except Exception as kor_error:
                error_message = f"Error solving Korea model: {kor_error}"
                stack_trace = traceback.format_exc()
                print(error_message)
                print(stack_trace)
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        elif template_id == 'saudi-cge':
            try:
                from models.model_wrappers import solve_saudi
                results = solve_saudi()
                return jsonify(results)

            except Exception as sau_error:
                error_message = f"Error solving Saudi model: {sau_error}"
                stack_trace = traceback.format_exc()
                print(error_message)
                print(stack_trace)
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

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


@app.route('/register', methods=['POST'])
def register():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    avatar = data.get('avatar')
    if not avatar:
        # Generate default avatar as "<LETTER>|<COLOR>"
        color = '#%06x' % random.randint(0, 0xFFFFFF)
        avatar = f"{username[0].upper()}|{color}"
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    try:
        with get_db_connection() as conn:
            conn.execute(
                'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
                (username, generate_password_hash(password), avatar)
            )
            conn.commit()
        return jsonify({'message': 'User registered successfully'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/login', methods=['POST'])
def login():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    try:
        with get_db_connection() as conn:
            cur = conn.execute('SELECT password, avatar FROM users WHERE username=?', (username,))
            row = cur.fetchone()
        if row and check_password_hash(row['password'], password):
            return jsonify({'message': 'Login successful', 'username': username, 'avatar': row['avatar']})
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/runs', methods=['POST'])
def record_run():
    try:
        data = parse_json_request(request)
    except RequestValidationError as exc:
        return jsonify({'error': exc.message}), exc.status_code

    user_id = data.get('userId')
    username = data.get('username')
    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    template_id = data.get('templateId')
    params = data.get('params', {})
    sam = data.get('sam')
    results = data.get('results', {})

    run_id = insert_run(user_id, template_id, params, sam, results)
    return jsonify({'id': run_id, 'message': 'Run saved'})


@app.route('/runs', methods=['GET'])
def list_runs():
    username = request.args.get('username')
    user_id = request.args.get('userId', type=int)

    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    runs = fetch_runs_for_user(user_id)
    return jsonify(runs)


@app.route('/runs/<int:run_id>', methods=['GET'])
def get_run(run_id: int):
    run = fetch_run(run_id)
    if run:
        return jsonify(run)
    return jsonify({'error': 'Run not found'}), 404


@app.route('/runs/<int:run_id>', methods=['DELETE'])
def remove_run(run_id: int):
    username = request.args.get('username')
    user_id = request.args.get('userId', type=int)

    if not user_id and username:
        user_id = get_user_id(username)

    run = fetch_run(run_id)
    if not run:
        return jsonify({'error': 'Run not found'}), 404

    if user_id and run['user_id'] != user_id:
        return jsonify({'error': 'Run not found for this user'}), 404

    delete_run(run_id)
    return jsonify({'message': 'Run deleted'})


@app.route('/runs', methods=['DELETE'])
def clear_runs():
    username = request.args.get('username')
    user_id = request.args.get('userId', type=int)

    if not user_id and username:
        user_id = get_user_id(username)

    if not user_id:
        return jsonify({'error': 'Valid userId or username required'}), 400

    delete_runs_for_user(user_id)
    return jsonify({'message': 'Run history cleared'})

@app.route('/compare-scenarios', methods=['POST'])
def compare_scenarios():
    try:
        try:
            data = parse_json_request(request)
        except RequestValidationError as exc:
            return jsonify({'error': exc.message}), exc.status_code

        template_id = data.get('templateId', 'simple-cge')
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

        if template_id == 'korea-cge':
            try:
                from models.model_wrappers import solve_korea
                baseline_tariff = baseline_params.get('tariff')
                baseline_itax = baseline_params.get('indirectTax')
                baseline_htax = baseline_params.get('incomeTax')

                scenario_tariff = scenario_params.get('tariff')
                scenario_itax = scenario_params.get('indirectTax')
                scenario_htax = scenario_params.get('incomeTax')

                baseline_results = solve_korea(baseline_tariff, baseline_itax, baseline_htax)
                scenario_results = solve_korea(scenario_tariff, scenario_itax, scenario_htax)

                def diff_val(b: float, o: float) -> Dict[str, float]:
                    val = o - b
                    pct = (val / b * 100) if b != 0 else 0
                    return {'value': val, 'percentChange': pct}

                diffs = {
                    'omega': diff_val(baseline_results['omega'], scenario_results['omega']),
                    'y': diff_val(baseline_results['y'], scenario_results['y']),
                    'gr': diff_val(baseline_results.get('gr', 0), scenario_results.get('gr', 0)),
                    'yh': {hh: diff_val(baseline_results['yh'].get(hh, 0), scenario_results['yh'].get(hh, 0)) for hh in baseline_results['yh']}
                }

                return jsonify({
                    'baseline': baseline_results,
                    'scenario': scenario_results,
                    'differences': diffs
                })
            except Exception as kor_err:
                error_message = f"Error comparing Korea scenarios: {kor_err}"
                stack_trace = traceback.format_exc()
                print(error_message)
                print(stack_trace)
                return jsonify({'error': error_message, 'trace': stack_trace}), 500

        elif template_id == 'saudi-cge':
            try:
                from models.model_wrappers import solve_saudi
                baseline_tariff = baseline_params.get('tariff')
                baseline_itax = baseline_params.get('indirectTax')
                baseline_htax = baseline_params.get('incomeTax')

                scenario_tariff = scenario_params.get('tariff')
                scenario_itax = scenario_params.get('indirectTax')
                scenario_htax = scenario_params.get('incomeTax')

                baseline_results = solve_saudi(baseline_tariff, baseline_itax, baseline_htax)
                scenario_results = solve_saudi(scenario_tariff, scenario_itax, scenario_htax)

                def diff_val(b: float, o: float) -> Dict[str, float]:
                    val = o - b
                    pct = (val / b * 100) if b != 0 else 0
                    return {'value': val, 'percentChange': pct}

                diffs = {
                    'omega': diff_val(baseline_results['omega'], scenario_results['omega']),
                    'y': diff_val(baseline_results['y'], scenario_results['y']),
                    'gr': diff_val(baseline_results.get('gr', 0), scenario_results.get('gr', 0)),
                    'yh': {hh: diff_val(baseline_results['yh'].get(hh, 0), scenario_results['yh'].get(hh, 0)) for hh in baseline_results['yh']}
                }

                return jsonify({
                    'baseline': baseline_results,
                    'scenario': scenario_results,
                    'differences': diffs
                })
            except Exception as sau_err:
                error_message = f"Error comparing Saudi scenarios: {sau_err}"
                stack_trace = traceback.format_exc()
                print(error_message)
                print(stack_trace)
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


@app.route('/contact', methods=['POST'])
def contact():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')
    if not name or not email or not message:
        return jsonify({'error': 'Name, email and message are required'}), 400

    success, info = send_contact_email(name, email, message)
    if success:
        return jsonify({'message': 'Message sent'})
    return jsonify({'error': info}), 500

# Add a simple test route
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'ok',
        'message': 'CGE Model API is running'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5002, host='0.0.0.0')