import { Dimensions } from 'react-native';
import { isAndroidTV } from '../utils/tvDetection';

const { width, height } = Dimensions.get('window');

// TV detection
const IS_TV = isAndroidTV();

// Hero section height - smaller on TV to fit entire section on screen
// TV: 50% of screen height, Mobile/Tablet: 65% of screen height
export const HERO_HEIGHT = IS_TV ? height * 0.50 : height * 0.65;

// Screen dimensions
export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;

// Tablet detection
export const IS_TABLET = width >= 768;

// TV detection export
export const IS_TV_DEVICE = IS_TV;
