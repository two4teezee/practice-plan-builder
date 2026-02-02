I want to create a website that allows a hockey coach to dynamically build practice plans. this website should be easily deployable from a github repo to a vercel instance.


the desired workflow is as follows:
1. the coach navigates to the website. a navigation bar is presented on the left with the following options: create practice plan, view drills library, view previously generated practice plans. the default view is create practice plan.

for the practice plan view: 
2. the coach selects create practice plan. a new practice plan is created and the coach is presented with a list of drills in the drill library.
3. the coach can select a drill from the list and is presented with the drill details.
4. the coach can customize the drill details and add the drill to the practice plan.
5. the coach can save the practice plan and view it later.
6. the coach can export the practice plan to a word document, PDF or print it.

the practice plan should have the following fields: Practice Name, Practice Description, Practice Date, Practice Duration, Practice Location, Practice Drills, Practice Notes, Practice Equipment.

The Practice Drills field should be a list of drills that the coach has selected from the drill library. the coach should be able to drag and drop the drills into the list to reorder them. the coach should be able to remove a drill from the list by clicking the "x" icon next to the drill. the coach should be able to click on a drill to view the drill details.

The Practice Name should be a text field that defaults to the current date.
The Practice Description should be a text area that the coach can use to add a description of the practice plan.
The Practice Equipment should automatically concatenate the equipment from the drills selected for the practice plan.
The Practice Notes should be a text area that the coach can use to add notes to the practice plan.
The Practice Duration should be a dropdown with the following options: 30 minutes, 45 minutes, 50 minutes, 60 minutes, 75 minutes, 90 minutes.
The Practice Date should be a date picker.
The Practice Location should be a text field that defaults to "Hylo Park Arena".
The Practice Coach should be a dropdown with the following options: Coach 1, Coach 2, Coach 3, Coach 4, Coach 5.

if the coach selectes view drills library, the coach could now view all the drills in the drill library and have the ability to add drills to to the drill library as well.
7. the coach can select a drill from the list and is presented with the drill details, or can click on "create new drill" to create a new drill.
8. the coach can customize the drill details and add the drill to the drill library.
9. the coach can save the drill library and view it later.
10. the coach can export the drill library to a word document, PDF or print it.

drills in the drill library should have the following fields: Drill Name, Drill Category, Duration, Skill Focus, Objective, Setup, Execution, Coaching Points, Variations, Equipment. the coach should be able to add a description of the drill, a video link, and a link to a pdf of the drill.

the Drill Name field should be a text field.
the Drill Category field should be a dropdown with the following options: Skating, Shooting, Passing, Defensive, Offensive, Other.
the Duration field should be a dropdown with options from 0:30 to 30:00 in 0:30 increments.
the Skill Focus field should be a dropdown with the following options: Skating, Shooting, Passing, Defensive, Offensive, Other.
the Objective field should be a text area that the coach can use to add the objective of the drill.
the Setup field should be a text area that the coach can use to add the setup of the drill.
the Execution field should be a text area that the coach can use to add the execution of the drill.
the Coaching Points field should be a text area that the coach can use to add the coaching points of the drill.
the Variations field should be a text area that the coach can use to add the variations of the drill.
the Equipment field should be a text area that the coach can use to add the equipment needed for the drill.

the website should be simple and easy to use, but beautiful and laid out carefully. it should be responsive and work on all devices. it should be built with react and tailwind css. i should be able to test it locally. it will be hosted on github pages and it will be deployed to vercel. it should have a light mode and a dark mode.

the library of drills and the previous practice plans should be saved in a database. later we will add in th ability to login and authenticate to view specific data, but let's leave that feature off for now.