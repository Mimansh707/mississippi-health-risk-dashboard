import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://ms-health-risk-api.onrender.com',
});

export default API;
