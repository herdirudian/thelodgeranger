async function testLogin() {
  try {
    console.log("Testing Login...");
    const response = await fetch('http://127.0.0.1:5000/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'gm@lodge.com',
        password: 'password123'
      })
    });

    console.log("Status:", response.status);
    
    if (response.ok) {
        const data = await response.json();
        console.log("Login Success");
        console.log("Token:", data.accessToken ? "Received" : "Missing");
    } else {
        const text = await response.text();
        console.log("Login Failed");
        console.log("Response:", text);
    }
  } catch (error) {
    console.error("Network Error:", error.message);
  }
}

testLogin();
