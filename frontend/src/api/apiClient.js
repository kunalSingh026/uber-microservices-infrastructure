import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000', // Enforce API Gateway boundary
  timeout: 8000,
});

// Interceptor to transform connection errors into user-friendly localized messages
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    let userFriendlyMessage = 'A network connection issue occurred.';

    if (error.code === 'ECONNABORTED') {
      userFriendlyMessage = 'The command request took too long and timed out. Please try again.';
    } else if (!error.response) {
      userFriendlyMessage = 'Could not reach the Fleet Command Center. Please verify the API Gateway is online.';
    } else {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 502 || status === 504) {
        userFriendlyMessage = 'The requested subsystem is offline or unresponsive. Please check service health below.';
      } else if (status === 503) {
        userFriendlyMessage = 'The dispatch system is temporarily overloaded. Please retry shortly.';
      } else if (status === 400 || status === 422) {
        userFriendlyMessage = data.error || data.message || 'Invalid details provided.';
      } else if (status === 404) {
        userFriendlyMessage = 'Requested operation or vehicle was not found.';
      } else if (data && (data.error || data.message)) {
        userFriendlyMessage = data.error || data.message;
      }
    }

    // Embed the localized explanation inside the error object
    error.userFriendlyMessage = userFriendlyMessage;
    return Promise.reject(error);
  }
);

export default apiClient;
