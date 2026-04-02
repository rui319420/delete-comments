// Function to fetch and format user data
async function fetchUserData(userId: string) {
    /*
    * TODO: Switch the API endpoint to an environment variable
    * It is currently hardcoded, so be careful in production!
     */
    
    // The // inside this string (URL) should remain intact!
    const url = `https://api.example.com/v1/users/${userId}`;

    try {
        // Send a GET request to the API
        const response = await fetch(url);
        
        // The /* */ inside this string should also remain intact!
        const fakeCommentString = "Here is a string: /* do not delete me */";
        console.log(fakeCommentString);

        return await response.json(); // Convert the response to JSON and return it

    } catch (error) {
        /* Error handling in case something goes wrong */
        console.error("Error fetching user data:", error);
        return null;
    }
}