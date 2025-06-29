/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package deu.se.hackathon.Controller;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@Slf4j

/**
 *
 * @author 김희수
 */
public class DutyController {
    @GetMapping("/dutyView")
    public String DutySimpleController() {
        log.info("/dutyView/duty called...");
        return "dutyView/duty";
    }
}