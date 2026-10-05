let toastTimer;

export function createFeedback() {
  const toast = document.querySelector("#toast");
  return {
    toast(message) {
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
    },
    openDialog(dialog) {
      if (!dialog?.open && typeof dialog?.showModal === "function") dialog.showModal();
      document.body.classList.add("modal-open");
    },
    closeDialog(dialog) {
      if (dialog?.open) dialog.close();
      if (![...document.querySelectorAll("dialog")].some(item => item.open)) {
        document.body.classList.remove("modal-open");
      }
    },
    setupDialogs() {
      document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("close", () => {
        if (![...document.querySelectorAll("dialog")].some(item => item.open)) {
          document.body.classList.remove("modal-open");
        }
      }));
    }
  };
}
