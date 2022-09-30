# sql-openapi-gen

Generate jsona openapi from sql file

## Get Started

1. install tool

```
npm i -g sql-openapi-gen
```

2. prepare sql file

```sql
 CREATE TABLE `User` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(99) NOT NULL,
    `pass` VARCHAR(99) NOT NULL,
    `hobby` VARCHAR(99),
    `isForbid` TINYINT DEFAULT 0 COMMENT "Is forbidden user",
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uniqName` (`name`)
) COMMENT "User Table";
```

3. generate openapi file

```
sql-openapi-gen db.sql
```

will print

```json
  listUsers: { @endpoint({summary:"list user records"})
    route: "GET /users",
    req: {
      query: {}
    },
    res: {
      200: {
        count: 10,
        rows: [
          { @save("User")
            id: 1,
            name: "",
            pass: "",
            hobby: "",
            isForbid: 0, @description("Is forbidden user")
            createdAt: "<datetime>",
          }
        ]
      }
    }
  },
  createUser: { @endpoint({summary:"create user"})
    route: "POST /user",
    req: {
      body: {
        name: "",
        pass: "",
        hobby: "", @optional
      }
    },
    res: {
      200: { @use("User")
      }
    }
  },
  getUser: { @endpoint({summary:"get user info"})
    route: "GET /user/{}",
    req: {
      params: {
        id: 1,
      },
    },
    res: {
      200: { @use("User")
      }
    }
  },
  updateUser: { @endpoint({summary:"update user"})
    route: "PUT /user/{}",
    req: {
      params: {
        id: 1,
      },
      body: {
        name: "", @optional
        pass: "", @optional
        hobby: "", @optional
        isForbid: 0, @optional
      }
    },
    res: {
      200: {
        msg: "OK"
      }
    }
  },
  deleteUser: { @endpoint({summary:"delete user"})
    route: "DELETE /user/{}",
    req: {
      params: {
        id: 1,
      },
    },
    res: {
      200: {
        msg: "OK"
      }
    }
  },

```
