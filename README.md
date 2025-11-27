Cosmogenic Nuclide Burial Dating Clock
======================================

This animation was created for the Schaefer Cosmo Lab at the Lamont-Doherty Earth Observatory, Columbia University.

### Links

-   **Online Animation:** <https://greatest-125.github.io/cosmo-nuclide-clock/>

-   **Source Data & Formulas:** [Google Spreadsheet](https://docs.google.com/spreadsheets/d/1nPbZxIw4t08HUSHw_SKzBmXv3ULkpbIGiIdpQ2vziXw/edit?gid=1338351912#gid=1338351912 "null")

1\. Running the Animation Locally
---------------------------------

To run the animation on your own machine, follow these steps:

1.  **Download** this repository as a ZIP file and unzip it.

2.  Open your terminal/command prompt and navigate to the project folder.

3.  Ensure you have **Node.js** installed.

4.  Install the `live-server` by running:

    ```
    npm install -g live-server
    ```

5.  Start the server:

    ```
    live-server
    ```

    *Note: Ensure you are in the directory containing `index.html` and `sketch.js`.*

2\. Methodology
---------------
### Constants Used

To illustrate the differences between the isotopic systems, the model uses the following constants:

| Nuclide | Half-Life (t₁/₂) | Production Rate (P) |
|--------|-------------------|----------------------|
| ¹⁰Be   | 1.4 Myr           | 4 atoms/g/yr         |
| ²⁶Al   | 0.717 Myr         | 28 atoms/g/yr        |
| ³⁶Cl   | 0.301 Myr         | 12 atoms/g/yr        |

**Production Ratios:**

-   $^{26}\text{Al} / ^{10}\text{Be}$ Ratio: **7.0**

-   $^{36}\text{Cl} / ^{10}\text{Be}$ Ratio: **3.0**

### Equations Used
*based on Lal (1990)*

#### 1\. Decay Constant ($\lambda$)

Calculated from the half-life: 

$$\lambda = \frac{\ln(2)}{t_{1/2}}$$

#### 2\. Concentration during Exposure

When the rock is exposed, nuclides are produced by cosmic ray spallation while simultaneously decaying. The concentration $N(t)$ is calculated iteratively: $N(t) = \frac{P}{\lambda}(1 - e^{-\lambda t}) + N_0 e^{-\lambda t}$ *Where* $P$ *is the production rate and* $N_0$ *is the concentration from the previous time step.*

#### 3\. Concentration during Burial

When the rock is buried, production stops ($P=0$) and the equation becomes:

$$N(t) = N_0 e^{-\lambda t}$$

#### 4\. The "Burial Age" Clock

The animation calculates the "Apparent Burial Age" by comparing the measured ratio of two nuclides ($R_{measured}$) to the initial surface production ratio ($R_{initial}$).

Because $^{26}\text{Al}$ decays faster than $^{10}\text{Be}$, their ratio decreases over time. The age $t$ is derived as: $t = \frac{\ln(R_{measured} / R_{initial})}{\lambda_{10} - \lambda_{26}}$ 

### Assumptions & Simplifications

A number of simplifications were made when creating this animation (based on Balco et al., 2008):

The following factors are not taken into consideration:

-   Thickness correction

-   Geometric shielding correction

-   A scaling scheme taking into account time and location

-   An independently determined surface erosion rate

-   An effective attenuation length for spallogenic production

-   Sample thickness 

-   An effective attenuation length for production by muons
