import turtle
import time

# Set up the screen
screen = turtle.Screen()
screen.title('Simple Animation')
screen.bgcolor('black')

# Create and customize the turtle
t = turtle.Turtle()
t.speed(0)
t.color('cyan')

# Draw a spinning star
for _ in range(36):
    for _ in range(5):
        t.forward(100)
        t.right(144)
    t.right(10)

# Hide the turtle and keep window open
t.hideturtle()
screen.mainloop()