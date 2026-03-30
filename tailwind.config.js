export default {
    darkMode: "class", // Force class-based dark mode instead of system preference
    content: [
        "./public/index.html",
        "./functions/app/views/**/*.hbs",
        "./src/**/*.js",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Mako", "Roboto", "Arial", "sans-serif"],
                serif: ["Georgia", "Times New Roman", "serif"],
            },
        },
    },
};
