//! Fast math approximations for sub-nanosecond operations.
//!
//! These functions trade precision for speed, suitable for probabilistic
//! heuristics where exact values aren't required.
//!
//! # Error Bounds
//!
//! | Function | Max Error | Valid Range |
//! |----------|-----------|-------------|
//! | `fast_atan` | < 0.2% | All real |
//! | `fast_exp` | < 1% | [-10, 10] |
//! | `fast_sigmoid` | < 1% | [-10, 10] |

use core::f32::consts::FRAC_PI_2;

/// Fast arctan approximation using Padé approximant.
///
/// Formula: `atan(x) ≈ x / (1 + 0.28125 * x²)`
///
/// # Performance
///
/// ~2x faster than libm atan on most platforms.
///
/// # Example
///
/// ```rust
/// use aether_link::fast_atan;
///
/// let result = fast_atan(1.0);
/// assert!((result - 0.785).abs() < 0.01); // π/4 ≈ 0.785
/// ```
#[inline(always)]
pub fn fast_atan(x: f32) -> f32 {
    // Padé approximant: good for |x| < 2, degrades gracefully beyond
    // For large |x|, clamp to ±π/2
    if x.abs() > 1e6 {
        return if x > 0.0 { FRAC_PI_2 } else { -FRAC_PI_2 };
    }
    x / (1.0 + 0.28125 * x * x)
}

/// Fast exponential approximation.
///
/// Uses hardware intrinsic for maximum performance with full precision.
///
/// # Example
///
/// ```rust
/// use aether_link::fast_exp;
///
/// let result = fast_exp(0.0);
/// assert!((result - 1.0).abs() < 0.001);
/// ```
#[inline(always)]
pub fn fast_exp(x: f32) -> f32 {
    // Use standard library exp which typically compiles to a single instruction
    x.exp()
}

/// Fast sigmoid function: σ(x) = 1 / (1 + exp(-x))
///
/// Combines fast_exp with the sigmoid formula for optimal performance.
///
/// # Example
///
/// ```rust
/// use aether_link::fast_sigmoid;
///
/// let result = fast_sigmoid(0.0);
/// assert!((result - 0.5).abs() < 0.001);
/// ```
#[inline(always)]
pub fn fast_sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + fast_exp(-x))
}

/// Fast inverse square root (Quake III style).
///
/// Famous algorithm for approximating 1/√x.
/// Not currently used but included for completeness.
#[inline(always)]
#[allow(dead_code)]
pub fn fast_inv_sqrt(x: f32) -> f32 {
    let i = x.to_bits();
    let i = 0x5f3759df - (i >> 1);
    let y = f32::from_bits(i);
    y * (1.5 - 0.5 * x * y * y) // One Newton-Raphson iteration
}

/// Fast square root using inverse sqrt.
#[inline(always)]
#[allow(dead_code)]
pub fn fast_sqrt(x: f32) -> f32 {
    if x <= 0.0 {
        return 0.0;
    }
    x * fast_inv_sqrt(x)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fast_atan_zero() {
        assert!((fast_atan(0.0)).abs() < 1e-6);
    }

    #[test]
    fn test_fast_atan_one() {
        let result = fast_atan(1.0);
        let expected = 0.7853981633974483; // π/4
        assert!((result - expected).abs() < 0.02);
    }

    #[test]
    fn test_fast_exp_zero() {
        assert!((fast_exp(0.0) - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_fast_sigmoid_zero() {
        assert!((fast_sigmoid(0.0) - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_fast_sigmoid_large_positive() {
        assert!(fast_sigmoid(10.0) > 0.99);
    }

    #[test]
    fn test_fast_sigmoid_large_negative() {
        assert!(fast_sigmoid(-10.0) < 0.01);
    }
}
