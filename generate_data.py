import numpy as np
import pandas as pd

# constants
L10 = np.log(2)/1.4e6
L26 = np.log(2)/0.717e6
L36 = np.log(2)/0.301e6
Rp26_10 = 7.0
Rp36_10 = 3.0

def evolve_ratio(R, Rp, decay, prod_decay, dt, exposure=True):
    """Advance ratio for one time step (dt in yr)."""
    if exposure:
        # Approach production ratio
        return R + (Rp - R) * (1 - np.exp(-dt * (decay - prod_decay)))
    else:
        # Burial: only decay, no production
        return R * np.exp(-dt * (decay - prod_decay))

# time structure (in Myr)
steps = []
status = []

# Scenario 1: simple long exposure → burial
for t in np.linspace(0, 1.0, 100):  # 1 Myr exposure
    steps.append(t)
    status.append("EXPOSURE")
for t in np.linspace(1.0, 2.0, 100):  # 1 Myr burial
    steps.append(t)
    status.append("BURIAL")

# Initialize
R26, R36 = 0, 0
ratios26, ratios36 = [], []

for dt, st in zip(np.diff([0]+steps), status):
    exposure = (st == "EXPOSURE")
    R26 = evolve_ratio(R26, Rp26_10, L26, L10, dt*1e6, exposure)
    R36 = evolve_ratio(R36, Rp36_10, L36, L10, dt*1e6, exposure)
    ratios26.append(R26)
    ratios36.append(R36)

df = pd.DataFrame({
    "t_cumulative_Myr": steps,
    "R_26_10": ratios26,
    "R_36_10": ratios36,
    "status": status
})

df.to_csv("calculated_clock_data.csv", index=False)
