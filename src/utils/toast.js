import { toast } from "react-toastify";

export const TOAST_DURATION = Object.freeze({
  success: 8000,
  warning: 10000,
  error: 10000,
  info: 8000,
});

const withDuration = (duration, options = {}) => ({
  ...options,
  autoClose: duration,
});

export const notify = {
  success: (content, options) => toast.success(content, withDuration(TOAST_DURATION.success, options)),
  warning: (content, options) => toast.warning(content, withDuration(TOAST_DURATION.warning, options)),
  error: (content, options) => toast.error(content, withDuration(TOAST_DURATION.error, options)),
  info: (content, options) => toast.info(content, withDuration(TOAST_DURATION.info, options)),
};
