run:index.html
ifeq ($(OS),Windows_NT):
	cmd /c start index.html
else:
	open index.html
endif