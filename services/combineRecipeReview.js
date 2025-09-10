async function combineRecipeReview(recipesOrRecipe, reviews, favouriteRecipes) {

    // Check if recipesOrRecipe is an array
    const recipes = Array.isArray(recipesOrRecipe) ? recipesOrRecipe : [recipesOrRecipe];

    const updatedRecipeData = await Promise.all(recipes.map(async (recipe) => {
        const recipeId = recipe._id;

        // particular recipe review
        const matchingReviews = reviews.filter(review => review.recipeId.equals(recipeId) && review.isEnable === true);

        // Calculate rating statistics
        const ratingCounts = { 'one': 0, 'two': 0, 'three': 0, 'four': 0, 'five': 0 };
        let totalRating = 0;

        matchingReviews.forEach(review => {
            const rating = Math.floor(review.rating);
            const ratingKey = ['one', 'two', 'three', 'four', 'five'][rating - 1];
            if (ratingKey) {
                ratingCounts[ratingKey]++;
                totalRating += review.rating;
            }
        });
        
        // calculated average rating
        const averageRating = matchingReviews.length > 0 ? totalRating / matchingReviews.length : 0;

        // Include the feature image in the gallery if it exists
        let gallery = recipe.gallery || [] ||null;
        if (recipe.image && !gallery.includes(recipe.image)) {
            gallery.unshift(recipe.image); // Adds the feature image at the beginning of the gallery array
        }

        let isFavourite = false;
        
        // Checking if the recipe is a favorite
        if (favouriteRecipes.length > 0) {
            isFavourite = favouriteRecipes.some(favouriteRecipe => favouriteRecipe.recipeId.equals(recipeId));
        }

        return {
            ...recipe.toObject(),
            isFavourite: isFavourite,
            rating: ratingCounts,
            totalRating,
            averageRating,
            reviews: matchingReviews
        };

    }));

    return Array.isArray(recipesOrRecipe) ? updatedRecipeData : updatedRecipeData[0];
}

module.exports = combineRecipeReview;
