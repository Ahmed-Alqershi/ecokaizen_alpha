import numpy as np
import random

def generate_random_sam(sectors, factors, households, sector_names=None, factor_names=None, household_names=None):
    """
    Generate a random but balanced Social Accounting Matrix (SAM).

    Parameters:
    - sectors: Number of sectors/goods
    - factors: Number of factors of production
    - households: Number of households
    - sector_names: Optional list of custom names for sectors
    - factor_names: Optional list of custom names for factors
    - household_names: Optional list of custom names for households

    Returns:
    - entries: List of all SAM entry names
    - goods: List of goods/sectors
    - factors: List of factors
    - households: List of households
    - data: 2D numpy array of the SAM
    """
    # Validate inputs
    try:
        sectors = int(sectors)
        factors = int(factors)
        households = int(households)

        if sectors <= 0 or factors <= 0 or households <= 0:
            raise ValueError("Number of sectors, factors, and households must be positive integers")
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid dimensions: {str(e)}")

    print(f"Input validation passed: sectors={sectors}, factors={factors}, households={households}")

    # Process sector names
    goods_names = []
    if sector_names:
        # Use provided names, ensuring they're strings
        goods_names = [str(name).strip() for name in sector_names[:sectors] if name]

    # Fill in missing names or all if none provided
    if len(goods_names) < sectors:
        existing_count = len(goods_names)
        goods_names.extend([f"SECTOR{i+1}" for i in range(existing_count, sectors)])

    # Process factor names
    factors_names = []
    if factor_names:
        # Use provided names, ensuring they're strings
        factors_names = [str(name).strip() for name in factor_names[:factors] if name]

    # Fill in missing names or all if none provided
    if len(factors_names) < factors:
        existing_count = len(factors_names)
        factors_names.extend([f"FACTOR{i+1}" for i in range(existing_count, factors)])

    # Process household names
    households_names = []
    if household_names:
        # Use provided names, ensuring they're strings
        households_names = [str(name).strip() for name in household_names[:households] if name]

    # Fill in missing names or all if none provided
    if len(households_names) < households:
        existing_count = len(households_names)
        households_names.extend([f"HH{i+1}" for i in range(existing_count, households)])

    # Check for duplicate names across all entries
    entries = goods_names + factors_names + households_names
    if len(entries) != len(set(entries)):
        print("Warning: Duplicate names detected in SAM entries, adding unique suffixes")
        # Fix duplicates by adding suffixes
        name_count = {}
        for i, name in enumerate(entries):
            if name in name_count:
                name_count[name] += 1
                entries[i] = f"{name}_{name_count[name]}"
            else:
                name_count[name] = 0

        # Redistribute fixed names back to the original lists
        goods_names = entries[:sectors]
        factors_names = entries[sectors:sectors+factors]
        households_names = entries[sectors+factors:]

    total_entries = len(entries)

    print(f"Generated names: sectors={goods_names}, factors={factors_names}, households={households_names}")
    print(f"Total entries: {total_entries}")

    # Create an empty SAM
    sam = np.zeros((total_entries, total_entries))
    
    # Household consumption of goods
    for h_idx, _ in enumerate(households_names):
        household_col = sectors + factors + h_idx
        
        # Generate random consumption values for each good
        total_consumption = 100  # Fixed total for simplicity
        consumption_weights = np.random.rand(sectors)
        consumption_weights = consumption_weights / consumption_weights.sum() * total_consumption
        
        for g_idx, _ in enumerate(goods_names):
            sam[g_idx, household_col] = consumption_weights[g_idx]
    
    # Factor inputs to production
    for g_idx, _ in enumerate(goods_names):
        # Generate random factor input ratios
        total_inputs = sam[:, sectors + factors:].sum(axis=1)[g_idx]  # Sum of consumption for this good
        factor_weights = np.random.rand(factors)
        factor_weights = factor_weights / factor_weights.sum() * total_inputs
        
        for f_idx, _ in enumerate(factors_names):
            sam[sectors + f_idx, g_idx] = factor_weights[f_idx]
    
    # Factor income to households
    for f_idx, _ in enumerate(factors_names):
        factor_row = sectors + f_idx
        total_factor_income = sam[factor_row, :sectors].sum()  # Total factor payments from all sectors
        
        # Distribute to households based on random weights
        household_weights = np.random.rand(households)
        household_weights = household_weights / household_weights.sum()
        
        for h_idx, _ in enumerate(households_names):
            household_col = sectors + factors + h_idx
            sam[household_col, factor_row] = total_factor_income * household_weights[h_idx]
    
    # Ensure the SAM is balanced (row sums = column sums)
    for i in range(total_entries):
        row_sum = sam[i, :].sum()
        col_sum = sam[:, i].sum()
        
        # Adjust to ensure balance
        if row_sum > col_sum:
            # Distribute excess to relevant entries
            if i < sectors:  # Good
                # Add to factor inputs
                factor_idx = random.randint(0, factors-1)
                sam[sectors + factor_idx, i] += (row_sum - col_sum)
            elif i < sectors + factors:  # Factor
                # Add to household income
                household_idx = random.randint(0, households-1)
                sam[sectors + factors + household_idx, i] += (row_sum - col_sum)
            else:  # Household
                # Add to consumption
                good_idx = random.randint(0, sectors-1)
                sam[good_idx, i] += (row_sum - col_sum)
        
        elif col_sum > row_sum:
            # Distribute shortfall from relevant entries
            if i < sectors:  # Good
                # Add to household consumption
                household_idx = random.randint(0, households-1)
                sam[i, sectors + factors + household_idx] += (col_sum - row_sum)
            elif i < sectors + factors:  # Factor
                # Add to factor input
                good_idx = random.randint(0, sectors-1)
                sam[i, good_idx] += (col_sum - row_sum)
            else:  # Household
                # Add to factor income
                factor_idx = random.randint(0, factors-1)
                sam[i, sectors + factor_idx] += (col_sum - row_sum)
    
    # Round values to integers for better readability
    sam = np.round(sam).astype(int)
    
    # Final check for names consistency
    if len(goods_names) != sectors:
        print(f"Warning: goods_names length {len(goods_names)} doesn't match sectors {sectors}")
    if len(factors_names) != factors:
        print(f"Warning: factors_names length {len(factors_names)} doesn't match factors {factors}")
    if len(households_names) != households:
        print(f"Warning: households_names length {len(households_names)} doesn't match households {households}")
    
    # Validate SAM dimensions
    if sam.shape[0] != total_entries or sam.shape[1] != total_entries:
        error_msg = f"Error: SAM shape {sam.shape} doesn't match total entries {total_entries}"
        print(error_msg)
        raise ValueError(error_msg)

    # Validate that the SAM is balanced
    row_sums = sam.sum(axis=1)
    col_sums = sam.sum(axis=0)
    max_imbalance = np.max(np.abs(row_sums - col_sums))

    if max_imbalance > 0.01:
        print(f"Warning: SAM is not perfectly balanced. Maximum imbalance: {max_imbalance}")
        print("Applying final balancing adjustments...")

        # Apply an additional balancing step if needed
        for i in range(total_entries):
            row_sum = sam[i, :].sum()
            col_sum = sam[:, i].sum()
            diff = row_sum - col_sum

            if abs(diff) > 0.01:
                if i < sectors:  # If it's a sector
                    # Adjust factor input
                    factor_idx = np.argmax([sam[sectors + f_idx, i] for f_idx in range(factors)])
                    sam[sectors + factor_idx, i] += diff
                elif i < sectors + factors:  # If it's a factor
                    # Adjust household income
                    household_idx = np.argmax([sam[sectors + factors + h_idx, i] for h_idx in range(households)])
                    sam[sectors + factors + household_idx, i] += diff
                else:  # If it's a household
                    # Adjust consumption
                    good_idx = np.argmax([sam[g_idx, i] for g_idx in range(sectors)])
                    sam[good_idx, i] += diff

    # Round values to minimize floating point issues
    sam = np.round(sam, 2).astype(float)

    # Final validation
    for i in range(sam.shape[0]):
        for j in range(sam.shape[1]):
            if np.isnan(sam[i, j]) or np.isinf(sam[i, j]):
                sam[i, j] = 0
                print(f"Warning: Fixed invalid value at position [{i},{j}]")

    result = {
        'entries': entries,
        'goods': goods_names,
        'factors': factors_names,
        'households': households_names,
        'data': sam.tolist()
    }

    # Verify all required properties exist
    for key in ['entries', 'goods', 'factors', 'households', 'data']:
        if key not in result or not result[key]:
            error_msg = f"Error: Missing or empty required property '{key}' in SAM result"
            print(error_msg)
            raise ValueError(error_msg)

    # Print result for debugging
    print(f"Final SAM result keys: {result.keys()}")
    print(f"Entries: {len(result['entries'])}, Data shape: {len(result['data'])}x{len(result['data'][0]) if result['data'] else 0}")
    print(f"Goods: {result['goods']}")
    print(f"Factors: {result['factors']}")
    print(f"Households: {result['households']}")

    return result

if __name__ == "__main__":
    # Example usage
    result = generate_random_sam(2, 2, 1)
    print("Entries:", result['entries'])
    print("SAM Data:")
    print(np.array(result['data']))