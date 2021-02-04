import RegisterUser from "../models/registerUser.js";
import bcrypt from "bcrypt";

export const registerUser = async (req, res) => {
  console.log("/register", req.body);

  if (
    req.body.username === undefined ||
    req.body.username === "" ||
    req.body.password === undefined ||
    req.body.password === "" ||
    req.body.firstName === undefined ||
    req.body.firstName === "" ||
    req.body.lastName === undefined ||
    req.body.lastName === ""
  ) {
    res.status(400).json({ message: "Enter valid credentials" });
  } else {
    const user = await RegisterUser.findOne({ username: req.body.username });

    if (user) {
      res.status(409).json({ message: "Username already exists" });
    } else {
      try {
        const hash = await bcrypt.hash(req.body.password, 10);
        console.log(hash, req.body.password);
        const registerUser = new RegisterUser({
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          username: req.body.username,
          password: hash,
        });

        registerUser
          .save()
          .then((result) => res.json({ username: result.username }))
          .catch((err) => console.log(err));
      } catch (err) {
        console.error("error while hashing or storing user info into db", err);
      }
    }
  }
};
