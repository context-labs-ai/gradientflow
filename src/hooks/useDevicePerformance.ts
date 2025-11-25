import { useEffect, useState } from 'react';

export type PerformanceLevel = 'high' | 'medium' | 'low';

/**
 * Hook to detect device performance level
 * Based on hardware concurrency and available memory
 */
export const useDevicePerformance = (): PerformanceLevel => {
    const [performanceLevel, setPerformanceLevel] = useState<PerformanceLevel>(() => {
        if (typeof window === 'undefined') return 'medium';
        return detectPerformanceLevel();
    });

    useEffect(() => {
        // Re-detect on mount in case of SSR
        setPerformanceLevel(detectPerformanceLevel());
    }, []);

    return performanceLevel;
};

function detectPerformanceLevel(): PerformanceLevel {
    if (typeof window === 'undefined') return 'medium';

    const cores = navigator.hardwareConcurrency || 4;

    // Type assertion for memory property (non-standard)
    const memory = (navigator as any).deviceMemory;

    // Check if on mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    // High performance: desktop with 8+ cores or 8GB+ memory
    if (!isMobile && (cores >= 8 || (memory && memory >= 8))) {
        return 'high';
    }

    // Low performance: mobile with 2 cores or less, or 2GB or less memory
    if (isMobile || cores <= 2 || (memory && memory <= 2)) {
        return 'low';
    }

    // Medium performance: everything else
    return 'medium';
}

/**
 * Hook to determine if complex animations should be used
 * Combines reduced motion preference and device performance
 */
export const useShouldUseComplexAnimations = (): boolean => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const performanceLevel = useDevicePerformance();

    // Don't use complex animations if user prefers reduced motion
    if (prefersReducedMotion) return false;

    // Only use complex animations on high performance devices
    return performanceLevel === 'high';
};
