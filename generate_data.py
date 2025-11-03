import numpy as np
import pandas as pd

# --- decay constants ---
L10 = np.log(2) / 1.4e6
L26 = np.log(2) / 0.717e6
L36 = np.log(2) / 0.301e6

# --- production ratios ---
Rp26_10 = 7.0
Rp36_10 = 3.0

# --- simulation parameters ---
dt_yr = 5e3  # 5 kyr time step
segments = [
    ("BURIAL", 1.0e6),   # 1 Myr burial
    ("EXPOSURE", 0.5e6), # 0.5 Myr exposure
    ("BURIAL", 0.5e6)    # 0.5 Myr burial
]

# initialize at production equilibrium
R26, R36 = Rp26_10, Rp36_10
time, R26_list, R36_list, status_list = [0.0], [R26], [R36], ["START"]

for phase, duration in segments:
    nsteps = int(duration / dt_yr)
    for _ in range(nsteps):
        if phase == "BURIAL":
            # Decay only (no production)
            R26 *= np.exp(-dt_yr * (L26 - L10))
            R36 *= np.exp(-dt_yr * (L36 - L10))
        elif phase == "EXPOSURE":
            # Move toward production ratio (adding new nuclides)
            R26 += (Rp26_10 - R26) * (1 - np.exp(-dt_yr * (L26 - L10)))
            R36 += (Rp36_10 - R36) * (1 - np.exp(-dt_yr * (L36 - L10)))
        time.append(time[-1] + dt_yr)
        R26_list.append(R26)
        R36_list.append(R36)
        status_list.append(phase)

# convert to Myr and export
df = pd.DataFrame({
    "t_cumulative_Myr": np.array(time) / 1e6,
    "R_26_10": R26_list,
    "R_36_10": R36_list,
    "status": status_list
})

df.to_csv("calculated_clock_data.csv", index=False)
print("calculated_clock_data.csv written with", len(df), "rows")
