import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import reduceMotion from './postcss-reduce-motion.js';

// reduceMotion runs last so it also sees Tailwind's motion-reduce / motion-safe output
export default {
  plugins: [tailwindcss(), autoprefixer(), reduceMotion()],
};
