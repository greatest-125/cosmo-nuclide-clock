Cosmogenic Nuclide Burial Dating Clock
======================================

This animation was created for the Schaefer Cosmo Lab at the Lamont-Doherty Earth Observatory, Columbia University.

This version uses stable cosmogenic 3He together with 10Be and 36Cl. The two displayed clocks are therefore **3He / 10Be** and **3He / 36Cl**. Because 3He is stable and the raw ratios increase during exposure, the dials show **normalized ratios** that start at **1.0** at burial onset (12 o'clock) and trend toward **0.0** with continued burial (6 o'clock).

- **Online Animation:** <https://greatest-125.github.io/cosmo-nuclide-clock/>

1. Running the Animation Locally
--------------------------------

To run the animation on your own machine, follow these steps:

1. **Download** this repository as a ZIP file and unzip it.
2. Open your terminal and navigate to the folder.
3. Ensure you have **Node.js** installed.
4. Install `live-server` by running:

   ```
   npm install -g live-server
   ```

5. Start the server:

   ```
   live-server
   ```

   *Note: Ensure you are in the directory containing `index.html` and `sketch.js`.*

2. Methodology
--------------

### Constants Used

To illustrate the differences between the isotopic systems, the model uses the following constants:

| Nuclide | Half-Life (t1/2) | Production Rate (P) |
|--------|-------------------|----------------------|
| 10Be   | 1.4 Myr           | 4 atoms/g/yr         |
| 3He    | stable            | 100 atoms/g/yr       |
| 36Cl   | 0.301 Myr         | 12 atoms/g/yr        |

**Raw production-rate ratios (reference values only):**

- 3He / 10Be: **100 / 4 = 25.0**
- 3He / 36Cl: **100 / 12 = 8.33**

The animation does **not** place these raw ratios directly on the dial. Instead, it normalizes each ratio to its value at the start of burial so the dial remains bounded from 1 to 0.

### Equations Used

#### 1. Decay Constant (lambda)

For the radioactive nuclides, the decay constant is calculated from the half-life:

$$
\lambda = \frac{\ln(2)}{t_{1/2}}
$$

#### 2. Concentration During Exposure

For radioactive nuclides (10Be and 36Cl), production and decay are both active during exposure. Using the same simplified iterative approach as before:

$$
N(t + \Delta t) = \frac{P}{\lambda}\left(1 - e^{-\lambda \Delta t}\right) + N(t)e^{-\lambda \Delta t}
$$

where $P$ is the production rate, $\lambda$ is the decay constant, and $\Delta t$ is the time step (5,000 years in the animation).

For stable cosmogenic 3He, there is no decay, so exposure is represented as simple accumulation:

$$
N_{3\mathrm{He}}(t + \Delta t) = N_{3\mathrm{He}}(t) + P_{3\mathrm{He}}\,\Delta t
$$

For a single uninterrupted exposure starting from zero, this is equivalent to:

$$
N_{3\mathrm{He}} = P_{3\mathrm{He}}\,t
$$

#### 3. Concentration During Burial

During burial, production is set to zero.

For 10Be and 36Cl:

$$
N(t + \Delta t) = N(t)e^{-\lambda \Delta t}
$$

For stable 3He:

$$
N_{3\mathrm{He}}(t + \Delta t) = N_{3\mathrm{He}}(t)
$$

#### 4. The Normalized-Ratio Clocks

For each clock, the raw ratio is:

$$
R_{3\mathrm{He}/x} = \frac{N_{3\mathrm{He}}}{N_x}
$$

where $x$ is either 10Be or 36Cl.

At the onset of burial, the animation stores a reference ratio $R_{\mathrm{ref}}$. The dial then displays the normalized quantity:

$$
Q = \frac{R_{\mathrm{ref}}}{R_{\mathrm{measured}}}
$$

This means:

- $Q = 1$ at the start of burial (12 o'clock)
- $Q \rightarrow 0$ with continued burial (toward 6 o'clock)

For ideal burial with stable 3He and radioactive denominator $x$:

$$
Q_{3\mathrm{He}/x} = e^{-\lambda_x t}
$$

So the apparent burial ages are:

For the **3He / 10Be** system:

$$
t = \frac{\ln\left(R_{\mathrm{measured}}/R_{\mathrm{ref}}\right)}{\lambda_{10}}
    = -\frac{\ln(Q)}{\lambda_{10}}
$$

For the **3He / 36Cl** system:

$$
t = \frac{\ln\left(R_{\mathrm{measured}}/R_{\mathrm{ref}}\right)}{\lambda_{36}}
    = -\frac{\ln(Q)}{\lambda_{36}}
$$

During any re-exposure interval, the animation continues to show these as **apparent** burial ages relative to the ratio at burial onset.

### Initial Condition Used in the Sketch

The sketch starts from modeled surface inventories at **5 kyr** rather than from zero concentration. This means:

- 10Be and 36Cl begin from their 5 kyr modeled inventories under exposure.
- 3He begins from $P_{3\mathrm{He}} \times 5000 = 500{,}000$ atoms/g.

### Assumptions & Simplifications

The following factors are not taken into consideration:

- Thickness correction
- Geometric shielding correction
- A scaling scheme taking into account time and location
- An independently determined surface erosion rate
- An effective attenuation length for spallogenic production
- Sample thickness
- An effective attenuation length for production by muons
- Any loss or diffusion of 3He; it is treated here as perfectly stable and retained
