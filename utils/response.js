/**
 * RESPONSE UTILS
 * Standardizes API responses without changing the existing format.
 */

exports.success = (res, message, data = {}, status = 200) => {
    return res.status(status).json({
        success: true,
        message,
        ...data
    });
};

exports.error = (res, message, status = 400, data = {}) => {
    return res.status(status).json({
        success: false,
        message,
        ...data
    });
};

// For standard EJS redirects/renders with messages
exports.renderError = (res, view, title, messageText) => {
    return res.render(view, {
        title,
        message: { type: 'error', text: messageText }
    });
};

exports.renderSuccess = (res, view, title, messageText) => {
    return res.render(view, {
        title,
        message: { type: 'success', text: messageText }
    });
};
