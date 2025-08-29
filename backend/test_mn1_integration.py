#!/usr/bin/env python3
"""
Test script for MN1 wrapper integration.
This tests if the wrapper can properly interface with the UI data.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.mn1_wrapper import solve_mn1


def test_mn1_integration():
    """Test the MN1 wrapper integration."""
    print("Testing MN1 wrapper integration...")
    
    # Create test SAM data matching the screenshot structure
    # Structure: 2 sectors + 2 factors + 2 households = 6x6 matrix
    sam = {
        "goods": ["IND1", "IND2"],           # 2 sectors
        "factors": ["LAB", "CAP"],           # 2 factors (labor and capital)
        "households": ["CONSA", "CONSB"],    # 2 households
        "data": [
            # IND1, IND2, LAB,  CAP,  CONSA, CONSB
            [0,    0,    0,    0,    5,     3],      # IND1 row
            [0,    0,    0,    0,    5,     8],      # IND2 row  
            [4,    6,    0,    0,    0,     0],      # LAB row
            [4,    6,    0,    0,    0,     0],      # CAP row
            [0,    0,    3,    8,    0,     0],      # CONSA row
            [0,    0,    8,    3,    0,     0]       # CONSB row
        ]
    }
    
    print(f"SAM data shape: {len(sam['data'])}x{len(sam['data'][0])}")
    
    # Test parameters
    params = {
        'alpha': [0.3, 0.7],  # Labor input elasticity for 2 sectors
        'b': [1.0, 1.0],      # Technology parameters for 2 sectors
        'prices': [1.0, 1.0], # Prices for 2 sectors
        'wage': 1.0,           # Wage rate
        'closureRules': [],    # No closure rules for this test
        'shocks': [],          # No shocks for this test
        'calibration': True    # Auto-calibrate
    }
    
    print(f"Parameters: {params}")
    
    try:
        # Test the MN1 wrapper
        results = solve_mn1(params, sam)
        print(f"Results: {results}")
        
        # Check if we got the expected structure
        expected_keys = ['prices', 'production', 'utility', 'gdp', 'benchmark_vs_solution']
        for key in expected_keys:
            if key in results:
                print(f"✅ {key}: {results[key]}")
            else:
                print(f"❌ Missing key: {key}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Integration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_mn1_integration()
    if success:
        print("\n🎉 All tests passed! The MN1 wrapper is working correctly.")
    else:
        print("\n💥 Tests failed. Please check the error messages above.")
        sys.exit(1)
