"""
Test script for generating a SAM and solving the CGE model.
"""

import json
import requests

def test_generate_sam():
    """Test the generate-random-sam endpoint"""
    url = "http://localhost:5000/generate-random-sam"
    
    # Test with standard dimensions
    payload = {
        "dimensions": {
            "sectors": 3,
            "factors": 2,
            "households": 1,
            "sectorNames": ["Agriculture", "Industry", "Services"],
            "factorNames": ["Labor", "Capital"],
            "householdNames": ["Household"]
        }
    }
    
    print("Testing SAM generation with custom names...")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            
            # Check if all required keys exist
            required_keys = ['entries', 'goods', 'factors', 'households', 'data']
            missing_keys = [key for key in required_keys if key not in data]
            
            if missing_keys:
                print(f"Error: Missing keys in response: {missing_keys}")
                return False
            
            # Check if custom names were used
            if data['goods'] != payload['dimensions']['sectorNames']:
                print(f"Warning: Custom sector names not applied correctly.")
                print(f"Expected: {payload['dimensions']['sectorNames']}")
                print(f"Got: {data['goods']}")
            
            if data['factors'] != payload['dimensions']['factorNames']:
                print(f"Warning: Custom factor names not applied correctly.")
                print(f"Expected: {payload['dimensions']['factorNames']}")
                print(f"Got: {data['factors']}")
                
            if data['households'] != payload['dimensions']['householdNames']:
                print(f"Warning: Custom household names not applied correctly.")
                print(f"Expected: {payload['dimensions']['householdNames']}")
                print(f"Got: {data['households']}")
            
            # Print dimensions
            print(f"SAM generated successfully!")
            print(f"Entries: {len(data['entries'])}")
            print(f"Goods: {data['goods']}")
            print(f"Factors: {data['factors']}")
            print(f"Households: {data['households']}")
            print(f"Data dimensions: {len(data['data'])}x{len(data['data'][0]) if data['data'] else 0}")
            
            # Test the solve-model endpoint with the generated SAM
            return test_solve_model(data)
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"Exception during test: {str(e)}")
        return False

def test_solve_model(sam=None):
    """Test the solve-model endpoint"""
    url = "http://localhost:5000/solve-model"
    
    if sam:
        print("\nTesting model solving with custom SAM...")
        # Use the generated SAM
        alpha_values = [1.0/len(sam['goods'])] * len(sam['goods'])
        b_values = [1.0] * len(sam['goods'])
        
        payload = {
            "templateId": "simple-cge",
            "params": {
                "alpha": alpha_values,
                "b": b_values
            },
            "sam": sam
        }
    else:
        print("\nTesting model solving with default SAM...")
        # Use default SAM
        payload = {
            "templateId": "simple-cge",
            "params": {
                "alpha": [0.3, 0.7],
                "b": [1.0, 1.0]
            }
        }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            
            # Check if all required keys exist
            required_keys = ['prices', 'production', 'utility', 'gdp']
            missing_keys = [key for key in required_keys if key not in data]
            
            if missing_keys:
                print(f"Error: Missing keys in response: {missing_keys}")
                return False
            
            # Print results
            print(f"Model solved successfully!")
            print(f"Prices: {data['prices']}")
            print(f"Production: {data['production']}")
            print(f"Utility: {data['utility']}")
            print(f"GDP: {data['gdp']}")
            
            # Test the compare-scenarios endpoint
            return test_compare_scenarios(sam)
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"Exception during test: {str(e)}")
        return False

def test_compare_scenarios(sam=None):
    """Test the compare-scenarios endpoint"""
    url = "http://localhost:5000/compare-scenarios"
    
    if sam:
        print("\nTesting scenario comparison with custom SAM...")
        # Use the generated SAM
        alpha_base = [1.0/len(sam['goods'])] * len(sam['goods'])
        b_base = [1.0] * len(sam['goods'])
        
        # Create slightly different parameters for scenario
        alpha_scenario = [0.8/len(sam['goods'])] * (len(sam['goods'])-1)
        alpha_scenario.append(0.2)  # Last sector has higher utility weight
        b_scenario = [1.0] * (len(sam['goods'])-1)
        b_scenario.append(1.5)  # Last sector has higher productivity
        
        payload = {
            "baselineParams": {
                "alpha": alpha_base,
                "b": b_base
            },
            "scenarioParams": {
                "alpha": alpha_scenario,
                "b": b_scenario
            },
            "sam": sam
        }
    else:
        print("\nTesting scenario comparison with default SAM...")
        # Use default SAM
        payload = {
            "baselineParams": {
                "alpha": [0.3, 0.7],
                "b": [1.0, 1.0]
            },
            "scenarioParams": {
                "alpha": [0.5, 0.5],
                "b": [1.0, 1.2]
            }
        }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            
            # Check if all required keys exist
            required_keys = ['baseline', 'scenario', 'differences']
            missing_keys = [key for key in required_keys if key not in data]
            
            if missing_keys:
                print(f"Error: Missing keys in response: {missing_keys}")
                return False
            
            # Print results
            print(f"Scenario comparison successful!")
            print(f"Baseline GDP: {data['baseline']['gdp']}")
            print(f"Scenario GDP: {data['scenario']['gdp']}")
            
            for key in data['differences']['prices']:
                print(f"Price change for {key}: {data['differences']['prices'][key]['percentChange']}%")
            
            for key in data['differences']['production']:
                print(f"Production change for {key}: {data['differences']['production'][key]['percentChange']}%")
            
            print(f"Utility change: {data['differences']['utility']['percentChange']}%")
            print(f"GDP change: {data['differences']['gdp']['percentChange']}%")
            
            return True
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"Exception during test: {str(e)}")
        return False

if __name__ == "__main__":
    print("Starting backend tests...\n")
    
    # 1. Test with default SAM
    print("==== TEST 1: Using Default SAM ====")
    if test_solve_model():
        print("✅ TEST 1 PASSED: Default SAM model solved successfully")
    else:
        print("❌ TEST 1 FAILED: Issues with default SAM model")
    
    # 2. Test with generated SAM
    print("\n==== TEST 2: Using Generated SAM ====")
    if test_generate_sam():
        print("✅ TEST 2 PASSED: Generated SAM model solved successfully")
    else:
        print("❌ TEST 2 FAILED: Issues with generated SAM model")
        
    print("\nTests completed!")